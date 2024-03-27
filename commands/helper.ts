import { generateMnemonic } from "bip39";
import { ChainGrpcBankApi, IndexerGrpcAccountPortfolioApi, MsgExecuteContract, MsgSend, PrivateKey } from '@injectivelabs/sdk-ts'
import { getNetworkEndpoints, Network } from '@injectivelabs/networks'
import { encode } from 'js-base64';
import axios from 'axios';

import { userPath, settingsPath, fee, dexUrl, injAddr, treasury, rankPath, injExplorer } from '../config';
import { IRank, ISettings, Iuser, initialSetting, } from '../utils/type';
import { getTokenDecimal, readData, swap, tokenInfo, writeData } from '../utils';

let userData: Iuser = {}
let settings: ISettings = {}
let rankData: IRank = {}

const endpoints = getNetworkEndpoints(Network.Mainnet)
const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(endpoints.indexer)
const chainGrpcBankApi = new ChainGrpcBankApi(endpoints.grpc)

export const init = async () => {
  userData = await readData(userPath)
  settings = await readData(settingsPath)
  rankData = await readData(rankPath)
}

export const checkInfo = async (chatId: number) => {
  if (!(chatId.toString() in settings)) {
    settings[chatId] = initialSetting
    writeData(settings, settingsPath)
  }

  if (chatId.toString() in userData) return true
  else false
}

const getINJBalance = async (adderss: string) => {
  const portfolio = await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(adderss)
  for (let i = 0; i < portfolio.bankBalancesList.length; i++) {
    if (portfolio.bankBalancesList[i].denom == 'inj') {
      return Number(portfolio.bankBalancesList[i].amount) / 1e18
    }
  }
  return 0
}

export const fetch = async (chatId: number, botName?: string) => {
  try {

    const balance = await getINJBalance(userData[chatId].publicKey)
    userData[chatId].balance = balance
    writeData(userData, userPath)
    return {
      publicKey: userData[chatId].publicKey,
      privateKey: userData[chatId].privateKey,
      referralLink: userData[chatId].referralLink,
      balance
    }
  } catch (e) {
    return {
      publicKey: userData[chatId].publicKey,
      privateKey: userData[chatId].privateKey,
      referralLink: userData[chatId].referralLink,
      balance: 0
    }
  }
}

export const createWalletHelper = async (chatId: number, botName: string) => {
  const mnemonic = generateMnemonic();
  const privateKey = PrivateKey.fromMnemonic(mnemonic)
  const publicKey = privateKey.toAddress().toBech32()
  console.log({ injectiveAddress: publicKey, str: publicKey.toString(), base: privateKey.toPublicKey().toBase64() })

  const referralLink = `https://t.me/${botName}?ref=${encode(chatId.toString())}`
  userData[chatId] = {
    privateKey: privateKey.toPrivateKeyHex(),
    publicKey,
    balance: 0,
    referralLink,
    referees: [],
    referrer: '',
    buy: 0,
    sell: 0
  }
  writeData(userData, userPath)
  return {
    publicKey,
    balance: 0
  }
}

export const importWalletHelper = async (chatId: number, privateKeyHex: string, botName: string) => {
  const privateKey = PrivateKey.fromHex(privateKeyHex)
  const publicKey = privateKey.toAddress().toBech32()
  const referralLink = `https://t.me/${botName}?ref=${encode(chatId.toString())}`
  try {
    const balance = await getINJBalance(userData[chatId].publicKey)
    userData[chatId] = {
      privateKey: privateKey.toPrivateKeyHex(),
      publicKey,
      balance,
      referralLink,
      referees: [],
      referrer: '',
      buy: 0,
      sell: 0
    }
    writeData(userData, userPath)
    return {
      publicKey,
      privateKey,
      referralLink,
      balance
    }

  } catch (e) {
    userData[chatId] = {
      privateKey: privateKey.toPrivateKeyHex(),
      publicKey: publicKey.toString(),
      balance: 0,
      referralLink,
      referees: [],
      referrer: '',
      buy: 0,
      sell: 0
    }
    writeData(userData, userPath)
    return {
      publicKey,
      privateKey,
      referralLink,
      balance: 0
    }

  }
}

export const checkValidAddr = async (addr: string) => {
  try {
    const info = await tokenInfo(addr)
    if (!info) return
    const dc = await getTokenDecimal(addr)
    let currentToken
    if (info.baseToken.address == addr) currentToken = { ...info.baseToken, decimals: dc }
    else currentToken = { ...info.quoteToken, decimals: dc }
    return {
      symbol: currentToken.symbol, name: currentToken.name, decimals: currentToken.decimals, SOLprice: info.priceNative, USDprice: info.priceUsd, volume: info.volume,
      priceX: info.priceChange, mcap: info.liquidity.usd
    }
  } catch (e) {
    console.log(e)
    throw new Error('')
  }
}

export const getSetting = async (chatId: number) => {
  if ((chatId in settings)) {
    settings = await readData(settingsPath)
  } else {
    settings[chatId] = initialSetting
    writeData(settings, settingsPath)
  }
  return settings[chatId]
}

export const setSettings = async (chatId: number, category: string, value?: any) => {
  if (category == 'announcement') settings[chatId]['announcement'] = !settings[chatId]['announcement']
  else if (category == 'priority') {
    switch (settings[chatId].priority) {
      case 'Custom':
        settings[chatId].priority = 'Medium'
        settings[chatId].priorityAmount = 0.0001
        break
      case 'Medium':
        settings[chatId].priority = 'High'
        settings[chatId].priorityAmount = 0.0005
        break
      case 'High':
        settings[chatId].priority = 'Very High'
        settings[chatId].priorityAmount = 0.001
        break
      case 'Very High':
        settings[chatId].priority = 'Medium'
        settings[chatId].priorityAmount = 0.0001
        break
    }
  }
  else {
    //@ts-ignore
    settings[chatId][category] = value
    if (category == 'priorityAmount') settings[chatId]['priority'] = 'Custom'
  }
  writeData(settings, settingsPath)
  return settings[chatId]
}

export const swapTokenHelper = async (chatId: number, value: string, tokenAddr: string, type: string) => {
  settings = await readData(settingsPath)
  userData = await readData(userPath)
  const setInfo = settings[chatId]
  const userInfo = userData[chatId]
  let amount: number
  const platformFeeBps = fee
  const privateKeyHash = userInfo.privateKey
  const privateKey = PrivateKey.fromHex(privateKeyHash);
  const injectiveAddress = privateKey.toBech32();
  const signer = privateKey.toAddress();
  const pubKey = privateKey.toPublicKey().toBase64();

  if (type == 'buy') {
    switch (value) {
      case 'buyS':
        amount = setInfo.buy1
        break
      case 'buyL':
        amount = setInfo.buy2
        break
      default:
        amount = Number(value)
    }
    if (amount > userData[chatId].balance) return { success: false, data: 'Insufficient balance' }
    const payAmount = Number(amount) * (1 - fee / 100) * Math.pow(10, 18)
    const treasuryAmount = Number(amount) * (fee / 100) * Math.pow(10, 18)

    const slippageBps = (setInfo.slippage1 / 100).toString()

    const feeJSONMsg = {
      amount: {
        denom: 'inj',
        amount: treasuryAmount.toString()
      },
      srcInjectiveAddress: injectiveAddress,
      dstInjectiveAddress: treasury
    };

    const feeMsg = MsgSend.fromJSON(feeJSONMsg)

    const swapJSONMsg = {
      sender: signer.address,
      contractAddress: tokenAddr,
      funds: {
        denom: "inj",
        amount: payAmount.toString(),
      },
      msg: {
        swap: {
          offer_asset: {
            info: {
              native_token: {
                denom: "inj",
              },
            },
            amount: payAmount.toString(),
          },
          max_spread: slippageBps,
          to: signer.address,
        },
      },
    };
    const swapMsg = MsgExecuteContract.fromJSON(swapJSONMsg)
    const msg = [feeMsg, swapMsg]
    const result = await swap(privateKey, injectiveAddress, pubKey, msg)
    if (result.success) {
      const currentBuy = isNaN(Number(userData[chatId].buy)) ? 0 : Number(userData[chatId].buy)
      userData[chatId].buy = currentBuy + payAmount
      writeData(userData, userPath)
      const currentRank = isNaN(Number(rankData[chatId])) ? 0 : Number(rankData[chatId])
      rankData[chatId] = currentRank + payAmount
      writeData(rankData, rankPath)
    }
    return result

  } else {
    // switch (value) {
    //   case 'sellS':
    //     amount = setInfo.sell1
    //     break
    //   case 'sellL':
    //     amount = setInfo.sell2
    //     break
    //   default:
    //     amount = Number(value)
    // }
    // const bal = await getTokenBalance(chatId, tokenAddr)
    // const payAmount = Math.floor(bal.value.uiAmount! * Number(amount) / 100 * Math.pow(10, (await checkValidAddr(tokenAddr))?.decimals!))
    // // try {
    // const slippageBps = setInfo.slippage2

    // const result = await tokenSwap(ammId, tokenAddr, tokenDecimals, injAddr, 9, amount, slippageBps, platformFeeBps, userPublicKey, userPrivateKey, computeUnitPriceMicroLamports)
    // console.log('result', result)
    // if (!result.error) userTokens[chatId].push({ token: tokenAddr })
    // return result
    // } catch (e) {
    //   if (e instanceof Error) {
    //     console.log('name', e.name)
    //     console.log('message', e.message)
    //     return { error: e.name }
    //   } else return undefined
    // }
  }
}

// -------------------------------------
export const getTokenInfoHelper = async (address: string, chatId: number) => {
  const dex = (await axios.get(`${dexUrl}/${address}`)).data
  if (!('pairs' in dex)) return undefined
  const pairs = dex.pairs
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].chainId == 'injective' && pairs[i].dexId == 'dojoswap' && ((pairs[i].baseToken.address == injAddr && pairs[i].quoteToken.address == address) || (pairs[i].quoteToken.address == injAddr && pairs[i].baseToken.address == address))) {
      const tokenInfo = pairs[i].baseToken.address == address ? pairs[i].baseToken : pairs[i].quoteToken
      const price = pairs[i].priceUsd
      const priceChange = pairs[i].priceChange
      const fdv = pairs[i].fdv
      const pairAddress = pairs[i].pairAddress
      const { balance } = await fetch(chatId)
      return { tokenInfo, price, priceChange, fdv, pairAddress, balance }
    }
  }
}

export const getTopTradersHelper = async () => {
  rankData = await readData(rankPath)
  const sortedData: [string, number][] = Object.entries(rankData).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const content: { text: string; url: string; }[][] = []
  sortedData.map((item, idx) => {
    content.push([{ text: `${idx} | ${userData[item[0]].publicKey} | ${item[1] / Math.pow(10, 18)} INJ`, url: `${injExplorer}/account/${userData[item[0]].publicKey}` }])
  })
  return content
}

export const getAllTokenList = async (chatId: number) => {
  const address = userData[chatId].publicKey
  // const data = await chainGrpcBankApi.fetchBalances(address)

  // console.log(data)
  // const portfolio = await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(address)
  // console.log(portfolio.bankBalancesList)
  // let balance = 0
  // for (let i = 0; i < portfolio.bankBalancesList.length; i++) {
  //   if (portfolio.bankBalancesList[i].denom === 'inj') {
  //     balance += Number(portfolio.bankBalancesList[i].amount) / 1e18
  //   } else if (portfolio.bankBalancesList[i].denom === 'usdc') {
  //     const tokenInfo = await tokenInfo('usdc')
  //     const decimals = tokenInfo.decimals
  //     const amount = Number(portfolio.bankBalancesList[i].amount) / Math.pow(10, decimals)
  //     balance += amount
  //   }
  // }

}