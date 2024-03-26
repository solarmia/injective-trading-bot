import * as web3 from '@solana/web3.js'
import { ethers } from 'ethers';
import { generateMnemonic, validateMnemonic } from "bip39";
import { ChainGrpcBankApi, IndexerGrpcAccountPortfolioApi, MsgExecuteContract, MsgSend, IndexerGrpcAccountApi } from '@injectivelabs/sdk-ts'
import { getNetworkEndpoints, Network } from '@injectivelabs/networks'
import { PrivateKey } from '@injectivelabs/sdk-ts'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, getTokenMetadata } from '@solana/spl-token';
import bs58 from 'bs58';
import { Coin } from '@injectivelabs/ts-types';
import { encode } from 'js-base64';
import axios from 'axios';
import fs from 'fs';
import { ChainId } from "@injectivelabs/ts-types";

import { RpcURL, userPath, statusPath, userTokenPath, tokensPath, logoPath, settingsPath, fee, quoteURL, feeAccountAddr, feeAccountSecret, swapURL, txPath, poolListPath, dexUrl, injAddr, treasury } from '../config';
import { ISettings, IUserToken, ITokenData, Iuser, initialSetting, IUserTokenList, ITxes, IPair, IPairs, IPool } from '../utils/type';
import { getTokenDecimal, readData, swap, tokenInfo, writeData } from '../utils';
import { toEditorSettings } from 'typescript';
import { LIQUIDITY_STATE_LAYOUT_V4 } from '@raydium-io/raydium-sdk';

let userData: Iuser = {}
let userTokens: IUserTokenList = {}
let tokens: IPairs
let settings: ISettings = {}
let tx: ITxes = {}
let poolList: IPool[] = []

const connection = new web3.Connection(RpcURL)
const endpoints = getNetworkEndpoints(Network.Mainnet)
const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(
  endpoints.indexer,
)
const indexerGrpcAccountApi = new IndexerGrpcAccountApi(endpoints.indexer)
const chainGrpcBankApi = new ChainGrpcBankApi(endpoints.grpc)

export const init = async () => {
  userData = await readData(userPath)
  userTokens = await readData(userTokenPath)
  tokens = await readData(tokensPath)
  settings = await readData(settingsPath)
  tx = await readData(txPath)
  poolList = await readData(poolListPath)
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

  // const newKepair = new web3.Keypair();
  // const publicKey = newKepair.publicKey.toString();
  // const privateKey = bs58.encode(Buffer.from(newKepair.secretKey))
  const referralLink = `https://t.me/${botName}?ref=${encode(chatId.toString())}`
  userData[chatId] = {
    privateKey: privateKey.toPrivateKeyHex(),
    publicKey,
    balance: 0,
    referralLink,
    referees: [],
    referrer: ''
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
  // const publicKey = privateKey.toPublicKey().toBase64()
  const referralLink = `https://t.me/${botName}?ref=${encode(chatId.toString())}`
  try {
    const balance = await getINJBalance(userData[chatId].publicKey)
    userData[chatId] = {
      privateKey: privateKey.toPrivateKeyHex(),
      publicKey,
      balance,
      referralLink,
      referees: [],
      referrer: ''
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
      referrer: ''
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
    tokens[addr] = { ...info, decimals: dc }
    writeData(tokens, tokensPath)
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

export const getTokenBalance = async (chatId: number, address: string) => {
  const sourceAccount = await getAssociatedTokenAddress(
    new web3.PublicKey(address),
    new web3.PublicKey(userData[chatId].publicKey)
  );

  const info = await connection.getTokenAccountBalance(sourceAccount);
  return info
}

export const buyTokenHelper = async (chatId: number, value: string, tokenAddr: string, type: string) => {
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
    const payAmount = Number(amount) * (1 - fee / 100) * Math.pow(10, 18)
    const treasuryAmount = Number(amount) * (fee / 100) * Math.pow(10, 18)

    // try {
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
    return result

  } else {
    //   switch (value) {
    //     case 'sellS':
    //       amount = setInfo.sell1
    //       break
    //     case 'sellL':
    //       amount = setInfo.sell2
    //       break
    //     default:
    //       amount = Number(value)
    //   }
    //   const bal = await getTokenBalance(chatId, tokenAddr)
    //   amount = Math.floor(bal.value.uiAmount! * Number(amount) / 100 * Math.pow(10, (await checkValidAddr(tokenAddr))?.decimals!))
    //   // try {
    //   const slippageBps = setInfo.slippage2

    //   const result = await tokenSwap(ammId, tokenAddr, tokenDecimals, injAddr, 9, amount, slippageBps, platformFeeBps, userPublicKey, userPrivateKey, computeUnitPriceMicroLamports)
    //   console.log('result', result)
    //   if (!result.error) userTokens[chatId].push({ token: tokenAddr })
    //   return result
    //   // } catch (e) {
    //   //   if (e instanceof Error) {
    //   //     console.log('name', e.name)
    //   //     console.log('message', e.message)
    //   //     return { error: e.name }
    //   //   } else return undefined
    //   // }
  }
}

export const getAllTokenList = async (chatId: number) => {
  userData = await readData(userPath)
  userTokens = await readData(userTokenPath)

  const subaccountsList = await indexerGrpcAccountApi.fetchSubaccountsList(
    userData[chatId].publicKey,
  )

  console.log(subaccountsList)

  return 

  // const tokenMetadata = await Promise.all(
  //   tokenAddresses.map(async (tokenAddress) => {
  //     const token = new Token(connection, tokenAddress, TOKEN_PROGRAM_ID);
  //     const tokenInfo = await token.getMintInfo();
  //     return {
  //       tokenAddress: tokenAddress.toBase58(),
  //       tokenName: tokenInfo.name,
  //       tokenSymbol: tokenInfo.symbol,
  //       tokenDecimals: tokenInfo.decimals,
  //     };
  //   })
  // );
}

const getPoolId = async (token: string) => {
  if (tokens[token].baseToken.address == injAddr || tokens[token].quoteToken.address == injAddr) return tokens[token].pairAddress
  else {
    for (let i = 0; i < poolList.length; i++) {
      if ((poolList[i].tokenA == token && poolList[i].tokenB == injAddr) || (poolList[i].tokenB == token && poolList[i].tokenA == injAddr)) {
        return poolList[i].pair

        // const account = await connection.getAccountInfo(new web3.PublicKey(poolList[i].pair))
        // if (account) {console.log(LIQUIDITY_STATE_LAYOUT_V4.decode(account.data).swapBaseInAmount.toString())}
        // const account = await connection.getBalance(new web3.PublicKey(poolList[i].pair))
        // console.log(account, item.pair)
        // if (poolList[i].pair == '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2') {
        //   // // const info = bs58.encode(account);
        //   // const info = bs58.encode(account?.data!);
        //   // console.log(info)
        //   if (account) {
        //     console.log(LIQUIDITY_STATE_LAYOUT_V4.decode(account.data).quoteVault.toString())
        //   }
        // }
      }
    }
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