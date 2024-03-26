import dotenv from "dotenv";
dotenv.config();

export const BotToken = process.env.TOKEN!
export const RpcURL = process.env.RPC_URL!
export const fee = Number(process.env.FEE_RATE)
export const feeAccountAddr = process.env.FEE_ACCOUNT_PUBKEY!
export const feeAccountSecret = process.env.FEE_ACCOUNT_PRIVKEY!
export const dexUrl = process.env.DEX_URL!

export const userPath = './user.json'
export const statusPath = './status.json'
export const tokensPath = './tokensList.json'
export const poolListPath = './poolList.json'
export const userTokenPath = './userToken.json'
export const settingsPath = './settings.json'
export const txPath = './tx.json'
export const logoPath = './token.png'
export const quoteURL = 'https://quote-api.jup.ag/v6/quote'
export const swapURL = 'https://quote-api.jup.ag/v6/swap'
export const injAddr = 'inj'
export const dojoPairUrl = 'https://dojo.trading/pairs'
export const injExplorer = 'https://explorer.injective.network'