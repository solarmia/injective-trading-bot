export interface IPOrder {
  privateKey: string,
  publicKey: string,
  amount: number,
  price: number,
  address: string
}

export interface IOrder {
  [key: string]: [IPOrder]
}
export interface IRank {
  [key: string]: number
}

export interface Iuser {
  [key: string]: {
    privateKey: string,
    publicKey: string,
    balance: number,
    referralLink: string,
    referees: string[],
    referrer: string,
    buy: number,
    sell: number
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

export const errorTitle: {
  [key: string]: string
} = {
  inputBuyTokenAddress: `Token not found. Make sure address is correct.`,
  inputTokenAmount: `Invalid amount. Make sure amount is correct.`,
  inputTokenPrice: `Invalid price. Make sure price is correct.`,
  internal: `Invalid action, please try again.`,
  lowINJBalance: `Low balance in your wallet.`,
}

interface IToken {
  decimals: number;
  name: string;
  symbol: string;
  logo: string;
  cw20: any; // You might want to specify the type of cw20 if it's known
  coinGeckoId: string;
  tokenType: string;
  denom: string;
}

export interface IContractData {
  contractAddress: string;
  account: string;
  balance: string;
  updatedAt: number;
  token: IToken;
}
