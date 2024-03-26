import { Enum, Keypair } from "@solana/web3.js"
import { StartPollingOptions } from "node-telegram-bot-api"
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  Currency,
  CurrencyAmount,
  TokenAmount,
  TOKEN_PROGRAM_ID,
  ENDPOINT as _ENDPOINT,
} from '@raydium-io/raydium-sdk';
// import { getWalletTokenAccount } from "../test";

export interface Iuser {
  [key: string]: {
    privateKey: string,
    publicKey: string,
    balance: number,
    referralLink: string,
    referees: string[],
    referrer: string
  }
}

export interface IUserTokenList {
  [key: string]: IUserToken[]
}
export interface IUserToken {
  token: string,
}

export interface ISettings {
  [key: string]: {
    announcement: boolean
    buy1: number
    buy2: number
    sell1: number
    sell2: number
    slippage1: number
    slippage2: number
    priority: string
    priorityAmount: number
  }
}

export const initialSetting = {
  announcement: false,
  buy1: 1,
  buy2: 2,
  sell1: 20,
  sell2: 80,
  slippage1: 10,
  slippage2: 20,
  priority: 'Medium',
  priorityAmount: 0.0001 //0.0005 0.001
}

export interface ITokenData {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  extensions: {
    website: string
  }
};

export const errorTitle: {
  [key: string]: string
} = {
  inputBuyTokenAddress: `Token not found. Make sure address is correct.`,
  inputTokenAmount: `Invalid amount. Make sure amount is correct.`,
  internal: `Invalid action, please try again.`,
  lowINJBalance: `Low balance in your wallet.`,
}

export interface ITx {
  signature: string,
  status: string
}

export interface ITxes {
  [key: string]: ITx[]
}

interface IToken {
  address: string;
  name: string;
  symbol: string;
}

interface Transactions {
  buys: number;
  sells: number;
}

interface Volume {
  h24: number;
  h6: number;
  h1: number;
  m5: number;
}

interface PriceChange {
  m5: number;
  h1: number;
  h6: number;
  h24: number;
}

interface ILiquidity {
  usd: number;
  base: number;
  quote: number;
}

export interface IPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: IToken;
  quoteToken: IToken;
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: Transactions;
    h1: Transactions;
    h6: Transactions;
    h24: Transactions;
  };
  volume: Volume;
  priceChange: PriceChange;
  liquidity: ILiquidity;
  fdv: number;
  pairCreatedAt: number;
}

export interface IPairs {
  [key: string]: IPair & { decimals: number }
}

export interface IPool {
  tokenA: string,
  tokenB: string,
  pair: string
}

// type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>

// export type TestTxInputInfo = {
//   outputToken: Token
//   targetPool: string
//   inputTokenAmount: CurrencyAmount
//   slippage: Percent
//   walletTokenAccounts: WalletTokenAccounts
//   wallet: Keypair
// }