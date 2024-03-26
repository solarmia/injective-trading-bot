import axios from 'axios';
import fs from 'fs';
import * as web3 from '@solana/web3.js'
import bs58 from 'bs58';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount, getTokenMetadata } from '@solana/spl-token';

import { RpcURL, dexUrl, feeAccountAddr, feeAccountSecret, quoteURL, swapURL, statusPath, tokensPath, fee, injAddr } from '../config';
import { ChainId } from "@injectivelabs/ts-types";
import {
  Network,
  getNetworkEndpoints,
  getNetworkInfo,
} from "@injectivelabs/networks";
import { Address, BaseAccount, ChainRestAuthApi, ChainRestTendermintApi, MsgExecuteContract, PrivateKey, TxClient, TxGrpcClient, createTransaction } from '@injectivelabs/sdk-ts';
import {
  DEFAULT_STD_FEE,
  DEFAULT_BLOCK_TIMEOUT_HEIGHT,
  BigNumberInBase,
  formatWalletAddress,
} from "@injectivelabs/utils";

const chainId = ChainId.Mainnet; /* ChainId.Mainnet */
const restEndpoint = getNetworkEndpoints(
  Network.Mainnet
).rest;
const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);
const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);

export const readData = async (Path: string): Promise<any> => {
  return JSON.parse(fs.readFileSync(Path, `utf8`));
}

export const writeData = async (data: any, path: any) => {
  const dataJson = JSON.stringify(data, null, 4);
  fs.writeFile(path, dataJson, (err) => {
    if (err) {
      console.log('Error writing file:', err);
    } else {
      console.log(`wrote file ${path}`);
    }
  });
}

export const tokenInfo = async (addr: string) => {
  const dex = (await axios.get(`${dexUrl}/${addr}`)).data
  if (!('pairs' in dex)) return undefined
  const pairs = dex.pairs
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].chainId == 'solana' && pairs[i].dexId == 'raydium' && ((pairs[i].baseToken.address == injAddr && pairs[i].quoteToken.address == addr) && (pairs[i].quoteToken.address == injAddr && pairs[i].baseToken.address == addr))) { return pairs[i] }
  }
  return pairs[0]
}

export const getTokenDecimal = async (addr: string) => {
}

export const swap = async (privateKey: PrivateKey, injectiveAddress: string, pubKey: string, swapMsg: MsgExecuteContract) => {
  try {
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      injectiveAddress
    );
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(
      DEFAULT_BLOCK_TIMEOUT_HEIGHT
    );

    const { txRaw, signBytes } = createTransaction({
      pubKey,
      chainId,
      fee: DEFAULT_STD_FEE,
      message: swapMsg,
      sequence: baseAccount.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: baseAccount.accountNumber,
    });
    const signature = await privateKey.sign(Buffer.from(signBytes));
    // console.log("signature -> \n", signature);

    const network = getNetworkInfo(Network.Mainnet);
    txRaw.signatures = [signature];

    /** Calculate hash of the transaction */
    // console.log(`txRaw: ${JSON.stringify(txRaw)}`);
    // console.log(`Transaction Hash: ${TxClient.hash(txRaw)}`);

    const txService = new TxGrpcClient(network.grpc);

    // console.log(`txService: ${txService}`);
    /** Simulate transaction */
    const simulationResponse = await txService.simulate(txRaw);

    // console.log(
    //   `Transaction simulation response: ${JSON.stringify(
    //     simulationResponse.gasInfo
    //   )}`
    // );

    /** Broadcast transaction */
    const txResponse = await txService.broadcast(txRaw);

    // console.log(txResponse);

    if (txResponse.code !== 0) {
      console.error(`Transaction failed: ${txResponse.rawLog}`);
      return { success: false, data: txResponse.rawLog }
    } else {
      console.error(
        `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`
      );
      return { success: true, data: txResponse.txHash }
    }
  } catch (e) {
    console.log(e)
    return { success: false, data: e }
  }
}