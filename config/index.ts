import dotenv from "dotenv";
dotenv.config();

export const BotToken = process.env.TOKEN!
export const RpcURL = process.env.RPC_URL!
export const fee = Number(process.env.FEE_RATE)
export const feeAccountAddr = process.env.FEE_ACCOUNT_PUBKEY!
export const feeAccountSecret = process.env.FEE_ACCOUNT_PRIVKEY!
export const dexUrl = process.env.DEX_URL!
export const treasury = process.env.TREASURY!

export const userPath = './user.json'
export const settingsPath = './settings.json'
export const rankPath = './rank.json'
export const orderPath = './order.json'
export const injAddr = 'inj'
export const dojoPairUrl = 'https://dojo.trading/pairs'
export const injExplorer = 'https://explorer.injective.network'