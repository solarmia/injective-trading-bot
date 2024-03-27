import { generateMnemonic } from "bip39";
import { ChainGrpcBankApi, ExplorerCW20BalanceWithToken, IndexerGrpcAccountPortfolioApi, IndexerGrpcOracleApi, IndexerRestExplorerApi, MsgExecuteContract, MsgSend, Msgs, PrivateKey, toBase64 } from '@injectivelabs/sdk-ts'
import { getNetworkEndpoints, Network } from '@injectivelabs/networks'
import { encode, decode } from 'js-base64';
import axios from 'axios';

import { userPath, settingsPath, fee, dexUrl, injAddr, treasury, rankPath, injExplorer, orderPath } from '../config';
import { IContractData, IOrder, IPOrder, IRank, ISettings, Iuser, initialSetting, } from '../utils/type';
import { getTokenDecimal, readData, swap, tokenInfo, writeData } from '../utils';
import { bot } from "..";

let userData: Iuser = {}
let settings: ISettings = {}
let rankData: IRank = {}
let orderData: IOrder = {}

const endpoints = getNetworkEndpoints(Network.Mainnet)
const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(endpoints.indexer)
const chainGrpcBankApi = new ChainGrpcBankApi(endpoints.grpc)
const indexerRestExplorerApi = new IndexerRestExplorerApi(
  `${endpoints.explorer}/api/explorer/v1`,
)

export const init = async () => {
  userData = await readData(userPath)
  settings = await readData(settingsPath)
  rankData = await readData(rankPath)
  orderData = await readData(orderPath)
}

export const checkInfo = async (chatId: number) => {
  if (!(chatId.toString() in settings)) {
    settings[chatId] = initialSetting
    writeData(settings, settingsPath)
  }
  if (chatId.toString() in userData && userData[chatId].privateKey) return true
  else false
}

export const validReferalLink = async (link: string, botName: string, chatId: number) => {
  const validation = `https://t.me/${botName}?ref=`
  if (link.startsWith(validation)) {
    const encoded = link.replace(validation, '')
    const decoded = decode(encoded)
    console.log(decoded)
    userData[decoded].referees.push(chatId.toString())
    const referralLink = `https://t.me/${botName}?ref=${encode(chatId.toString())}`
    userData[chatId] = {
      privateKey: "",
      publicKey: "",
      balance: 0,
      referralLink,
      referees: [],
      referrer: decoded,
      buy: 0,
      sell: 0
    }
    writeData(userData, userPath)
    return true
  } else {
    return false
  }
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
      balance,
      referees: userData[chatId].referees,
      referrer: userData[chatId].referrer
    }
  } catch (e) {
    return {
      publicKey: userData[chatId].publicKey,
      privateKey: userData[chatId].privateKey,
      referralLink: userData[chatId].referralLink,
      balance: 0,
      referees: userData[chatId].referees,
      referrer: userData[chatId].referrer
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
    const slippageBps = (setInfo.slippage1 / 100).toString()

    let result: {
      success: boolean;
      data: unknown;
    }

    if (userInfo.referrer) {
      const ref = userData[userInfo.referrer].publicKey
      const treasuryAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18) * 0.9)
      const refAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18) * 0.1)

      const refJSONMsg = {
        amount: {
          denom: 'inj',
          amount: refAmount.toString()
        },
        srcInjectiveAddress: injectiveAddress,
        dstInjectiveAddress: ref
      }
      const refMsg = MsgSend.fromJSON(refJSONMsg)

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
      await swap(privateKey, injectiveAddress, pubKey, refMsg)
      await swap(privateKey, injectiveAddress, pubKey, feeMsg)
      result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
    } else {
      const treasuryAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18))
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
      await swap(privateKey, injectiveAddress, pubKey, feeMsg)
      result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
    }

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
    switch (value) {
      case 'sellS':
        amount = setInfo.sell1
        break
      case 'sellL':
        amount = setInfo.sell2
        break
      default:
        amount = Number(value)
    }
    const tokenList = await indexerRestExplorerApi.fetchCW20BalancesNoThrow(injectiveAddress)
    const tokenInfo = tokenList.filter(item => item.contractAddress == tokenAddr)
    const totalAmount = Number(tokenInfo[0].balance) * amount / 100
    const payAmount = totalAmount * (1 - fee / 100)
    const slippageBps = (setInfo.slippage2 / 100).toString()
    const { pairAddress } = (await getTokenInfoHelper(tokenAddr, chatId))!
    const originINJBalance = await getINJBalance(userInfo.publicKey)

    let result: {
      success: boolean;
      data: unknown;
    }

    if (userInfo.referrer) {
      const ref = userData[userInfo.referrer].publicKey
      const treasuryAmount = totalAmount * fee / 100 * 0.9
      const refAmount = totalAmount * fee / 100 * 0.1

      const refJSONMsg = {
        contractAddress: tokenAddr,
        sender: injectiveAddress,
        exec: {
          action: "transfer",
          msg: {
            recipient: ref,
            amount: refAmount.toString(),
          },
        },
      }

      const refMsg = MsgExecuteContract.fromJSON(refJSONMsg)

      const feeJSONMsg = {
        contractAddress: tokenAddr,
        sender: injectiveAddress,
        exec: {
          action: "transfer",
          msg: {
            recipient: treasury,
            amount: treasuryAmount.toString(),
          },
        },
      }

      const feeMsg = MsgExecuteContract.fromJSON(feeJSONMsg)

      const swapJSONMsg = {
        sender: signer.address,
        contractAddress: tokenAddr,
        msg: {
          send: {
            contract: pairAddress,
            amount: payAmount.toString(),
            msg: toBase64({
              swap: { max_spread: slippageBps },
            }),
          },
        },
      };
      const swapMsg = MsgExecuteContract.fromJSON(swapJSONMsg)
      await swap(privateKey, injectiveAddress, pubKey, refMsg)
      await swap(privateKey, injectiveAddress, pubKey, feeMsg)
      result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
    } else {
      const treasuryAmount = totalAmount * fee / 100

      const feeJSONMsg = {
        contractAddress: tokenAddr,
        sender: injectiveAddress,
        exec: {
          action: "transfer",
          msg: {
            recipient: treasury,
            amount: treasuryAmount.toString(),
          },
        },
      }

      const feeMsg = MsgExecuteContract.fromJSON(feeJSONMsg)

      const swapJSONMsg = {
        sender: signer.address,
        contractAddress: tokenAddr,
        msg: {
          send: {
            contract: pairAddress,
            amount: payAmount.toString(),
            msg: toBase64({
              swap: { max_spread: slippageBps },
            }),
          },
        },
      };
      const swapMsg = MsgExecuteContract.fromJSON(swapJSONMsg)
      await swap(privateKey, injectiveAddress, pubKey, feeMsg)
      result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
    }
    if (result.success) {
      const currentINJBalance = await getINJBalance(userInfo.publicKey)
      const tradedAmount = (currentINJBalance - originINJBalance) * Math.pow(10, 18)
      const currentSell = isNaN(Number(userData[chatId].sell)) ? 0 : Number(userData[chatId].sell)
      userData[chatId].sell = currentSell + tradedAmount
      writeData(userData, userPath)
      const currentRank = isNaN(Number(rankData[chatId])) ? 0 : Number(rankData[chatId])
      rankData[chatId] = currentRank + tradedAmount
      writeData(rankData, rankPath)
    }
    return result
  }
}

export const getTopTradersHelper = async () => {
  rankData = await readData(rankPath)
  const sortedData: [string, number][] = Object.entries(rankData).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const content = []
  sortedData.map((item) => {
    const address = userData[item[0]].publicKey
    const shorAddress = address.slice(0, 8) + '...' + address.slice(-5)
    const volume = (item[1] / Math.pow(10, 18)).toFixed(6)
    content.push([{ text: `${shorAddress} : ${volume} INJ`, url: `${injExplorer}/account/${userData[item[0]].publicKey}` }])
  })
  content.push([{ text: `Close`, callback_data: `cancel` }])
  return content
}

export const getAllTokenList = async (chatId: number) => {
  const address = userData[chatId].publicKey
  const tokenList = await indexerRestExplorerApi.fetchCW20BalancesNoThrow(address)
  return tokenList
  // const portfolio = await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(address)
  // console.log(data)
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

export const addPlaceOrder = async (chatId: number, price: number, amount: number, address: string, type: 'buy' | 'sell') => {
  try {

    orderData[chatId] = [{
      privateKey: userData[chatId].privateKey,
      publicKey: userData[chatId].publicKey,
      amount,
      price,
      address,
      type
    }]
    writeData(orderData, orderPath)
    return true
  } catch (e) {
    console.warn(e)
    return false
  }
}

export const placeLimitOrder = async () => {
  setInterval(async () => {
    orderData = await readData(orderPath)
    for (const key in orderData) {
      if (Object.prototype.hasOwnProperty.call(orderData, key)) {
        for (let i = 0; i < orderData[key].length; i++) {
          console.log(orderData[key][i])
          const data = await checkPossibleOrder(orderData[key][i])
          if (data?.status == 0) {
            orderData[key].splice(i, 1)
            i--
            writeData(orderData, orderPath)
            continue
          } else if (data?.status == 2) {
            const res = await orderBuy(orderData[key][i], key, data.pairAddress)
            if (res) {
              orderData[key].splice(i, 1)
              writeData(orderData, orderPath)
              bot.sendMessage(key, `Order ${i + 1} placed successfully`)
              i--
              continue
            }
          }
        }
      }
    }
  }, 60000)
}

const orderBuy = async (data: IPOrder, chatId: string, tokenAddr: string) => {
  userData = await readData(userPath)
  settings = await readData(settingsPath)
  const userInfo = userData[chatId]
  const privateKeyHash = userInfo.privateKey
  const privateKey = PrivateKey.fromHex(privateKeyHash);
  const injectiveAddress = privateKey.toBech32();
  const signer = privateKey.toAddress();
  const pubKey = privateKey.toPublicKey().toBase64();
  const setInfo = settings[chatId]
  const { amount, address } = data
  if (amount > userData[chatId].balance) return false
  const payAmount = Number(amount) * (1 - fee / 100) * Math.pow(10, 18)
  const slippageBps = (setInfo.slippage1 / 100).toString()

  let result: {
    success: boolean;
    data: unknown;
  }

  if (userInfo.referrer) {
    const ref = userData[userInfo.referrer].publicKey
    const treasuryAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18) * 0.9)
    const refAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18) * 0.1)

    const refJSONMsg = {
      amount: {
        denom: 'inj',
        amount: refAmount.toString()
      },
      srcInjectiveAddress: injectiveAddress,
      dstInjectiveAddress: ref
    }
    const refMsg = MsgSend.fromJSON(refJSONMsg)

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
    await swap(privateKey, injectiveAddress, pubKey, refMsg)
    await swap(privateKey, injectiveAddress, pubKey, feeMsg)
    result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
  } else {
    const treasuryAmount = Math.floor(Number(amount) * (fee / 100) * Math.pow(10, 18))
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
    await swap(privateKey, injectiveAddress, pubKey, feeMsg)
    result = await swap(privateKey, injectiveAddress, pubKey, swapMsg)
  }

  if (result.success) {
    const currentBuy = isNaN(Number(userData[chatId].buy)) ? 0 : Number(userData[chatId].buy)
    userData[chatId].buy = currentBuy + payAmount
    writeData(userData, userPath)
    const currentRank = isNaN(Number(rankData[chatId])) ? 0 : Number(rankData[chatId])
    rankData[chatId] = currentRank + payAmount
    writeData(rankData, rankPath)
  }
  return true

}
export const checkPossibleOrder = async (data: IPOrder) => {
  const address = data.address
  const price = data.price
  const type = data.type
  if (type == "buy") {
    const dex = (await axios.get(`${dexUrl}/${address}`)).data
    if (!('pairs' in dex)) return { status: 0 } // no pair
    const pairs = dex.pairs
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].chainId == 'injective' && pairs[i].dexId == 'dojoswap' && ((pairs[i].baseToken.address == injAddr && pairs[i].quoteToken.address == address) || (pairs[i].quoteToken.address == injAddr && pairs[i].baseToken.address == address))) {
        const currentPrice = pairs[i].priceUsd
        if (currentPrice < price) return { status: 2, pairAddress: pairs[i].pairAddress } // possible
        else return { status: 1 } // impossible
      }
    }
  }
}


// ------------------------------------
const getUserCW20Balances = async (address: string, token: string) => {
  const indexerRestExplorerApi = new IndexerRestExplorerApi(
    `${endpoints.explorer}/api/explorer/v1`
  );

  const cw20Balances = await indexerRestExplorerApi.fetchCW20BalancesNoThrow(
    address
  );
  for (let i = 0; i < cw20Balances.length; i++) {
    if (cw20Balances[i].contractAddress == token)
      return cw20Balances[i];
  }
};

async function getNativeBalance(
  injectiveAddress: string
): Promise<string | undefined> {
  try {
    const portfolio =
      await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(
        injectiveAddress
      );

    console.log('portfolio', portfolio)
    return portfolio.bankBalancesList[0].amount;
  } catch (error) {
    console.error("Error creating wallet:", error);
    return undefined;
  }
}

const getInjPriceFiat = async () => {
  const indexerGrpcOracleApi = new IndexerGrpcOracleApi(endpoints.indexer);

  const oracleList = await indexerGrpcOracleApi.fetchOracleList();
  console.log('injOracle', oracleList)
  const injOracle = oracleList.find((list) => list.symbol === "INJ");
  return injOracle?.price;
};

export const getTokenPrice = async (injectiveAddress: string, token: string) => {
  console.log('here')
  const [injPrice, balances, nativBalance] = await Promise.all([
    getInjPriceFiat(),
    getUserCW20Balances(injectiveAddress, token),
    getNativeBalance(injectiveAddress),
  ]);

  if (!injPrice || !balances || !nativBalance) {
    console.error("Failed to fetch required data.");
    return;
  }

  const balance = balances.balance;
  const price = Number(nativBalance) / Number(balance);

  console.log(injPrice);
  const tokenPriceInUSD = price * Number(injPrice);

  console.log(
    `1 ${balances.token.symbol} = ${price.toFixed(5)} INJ approximately $${tokenPriceInUSD.toFixed(
      5
    )
    } `
  );

  return tokenPriceInUSD.toFixed(5);
}