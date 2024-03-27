import {
  MsgSend,
  PrivateKey,
  BaseAccount,
  ChainRestAuthApi,
  createTransaction,
  ChainRestTendermintApi,
  TxClient,
  TxGrpcClient,
  MsgExecuteContract,
  MsgExecuteContractCompat,
  InjectiveEthSecp256k1Wallet,
  InjectiveDirectEthSecp256k1Wallet,
  msgsOrMsgExecMsgs,
  toBase64,
  IndexerRestExplorerApi,
} from "@injectivelabs/sdk-ts";
import {
  TokenInfo,

} from '@injectivelabs/sdk-ts'
import {
  DEFAULT_STD_FEE,
  DEFAULT_BLOCK_TIMEOUT_HEIGHT,
  BigNumberInBase,
  formatWalletAddress,
} from "@injectivelabs/utils";
import {
  ChainId, TokenBalance,
  ChainRest,
  QueryClient, Token
} from "@injectivelabs/ts-types";
import {
  Network,
  getNetworkEndpoints,
  getNetworkInfo,
} from "@injectivelabs/networks";

const privateKeyHash = "0x9a9044a0f632ddff421d775db93bd13eac31bb87313efb2b687abf198c9deae6"; // change this
const privateKey = PrivateKey.fromHex(privateKeyHash);
const injectiveAddress = privateKey.toBech32();
const signer = privateKey.toAddress();
const pubKey = privateKey.toPublicKey().toBase64();
const chainId = ChainId.Mainnet; /* ChainId.Mainnet */
const restEndpoint = getNetworkEndpoints(
  Network.Mainnet
).rest; /* getNetworkEndpoints(Network.Mainnet).rest */

const swapDojo = async () => {
  try {
    console.log("start");
    /** Account Details **/
    const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      injectiveAddress
    );
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);
    const accountDetails = baseAccount.toAccountDetails();

    /** Block Details */
    const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(
      DEFAULT_BLOCK_TIMEOUT_HEIGHT
    );

    // const swapMsg = MsgExecuteContract.fromJSON({
    //   sender: signer.address,
    //   contractAddress: "inj1er0535pz8k3l6wpzm263vv9gmkghwct7he85pl", //pair
    //   funds: {
    //     denom: "inj",
    //     amount: "100000000000000",
    //   },
    //   msg: {
    //     swap: {
    //       offer_asset: {
    //         info: { 
    //           native_token: {
    //             denom: "inj",
    //           },
    //         },
    //         amount: "100000000000000",
    //       },
    //       max_spread: "0.05",
    //       to: signer.address,
    //     },
    //   },
    // });
    const swapMsg = MsgExecuteContract.fromJSON({
      sender: signer.address,
      contractAddress: "inj1zdj9kqnknztl2xclm5ssv25yre09f8908d4923", // Enter token address
      msg: {
        send: {
          contract: "inj1grtkdl7552kjsrkqn5wqpk4fp8m3m4y0tzqfqr", // Enter pair address
          amount: "9000000000000000000", // The amount of the origin token to swap from
          msg: toBase64({
            swap: { max_spread: "0.05" }, // optional
          }),
        },
      },
    });


    console.log("msg -> \n", swapMsg);

    /** Prepare the Transaction **/
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
    console.log("signature -> \n", signature);

    const network = getNetworkInfo(Network.Mainnet);
    txRaw.signatures = [signature];

    /** Calculate hash of the transaction */
    console.log(`txRaw: ${JSON.stringify(txRaw)}`);
    console.log(`Transaction Hash: ${TxClient.hash(txRaw)}`);

    const txService = new TxGrpcClient(network.grpc);

    console.log(`txService: ${txService}`);
    /** Simulate transaction */
    const simulationResponse = await txService.simulate(txRaw);

    console.log(
      `Transaction simulation response: ${JSON.stringify(
        simulationResponse.gasInfo
      )}`
    );

    /** Broadcast transaction */
    const txResponse = await txService.broadcast(txRaw);

    console.log(txResponse);

    if (txResponse.code !== 0) {
      console.log(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`
      );
    }
  } catch (e) {
    console.log(e);
  }
};

const getTokenBalance = async () => {
  const chainId = ChainId.Mainnet
  const restUrl = 'https://api.injective.network/cosmos/bank/v1beta1/'
  const queryClient = new QueryClient(restUrl)
  const chainRest = new ChainRest(restUrl)

  const tokenInfo: TokenInfo = await queryClient.getTokenInfo(
    'cw20-injective-usdt',
    chainId
  )

  const token = new Token(tokenInfo, chainId)

  const address = 'injective1...'
  const balance: TokenBalance = await chainRest.queryTokenBalance(
    address,
    token.denom,
    chainId
  )

}

swapDojo();
