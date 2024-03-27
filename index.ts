import "dotenv/config";
import TelegramBot, { CallbackQuery } from 'node-telegram-bot-api';

import * as commands from './commands'
import { BotToken } from "./config";
import { addPlaceOrder, init, placeLimitOrder } from "./commands/helper";

const token = BotToken
export const bot = new TelegramBot(token!, { polling: true });
let botName: string
let editText: string

console.log("Bot started");
placeLimitOrder()
bot.getMe().then(user => {
    botName = user.username!.toString()
})

bot.setMyCommands(commands.commandList)

init()

bot.on(`message`, async (msg) => {
    const chatId = msg.chat.id!
    const text = msg.text!
    const msgId = msg.message_id!
    const username = msg.from!.username!
    if (text) console.log(`message : ${chatId} -> ${text}`)
    else return
    let result
    try {
        switch (text) {
            case `/start`:
                await bot.deleteMessage(chatId, msgId)
                result = await commands.referralCheck(chatId)
                if (result) {
                    await bot.sendMessage(
                        chatId,
                        result
                    )
                    bot.once(`message`, async (msg) => {
                        if (msg.text == 'no' || msg.text == 'No' || msg.text == 'NO' || msg.text == 'n' || msg.text == 'N') {
                            await bot.deleteMessage(chatId, msg.message_id)
                            result = await commands.welcome(chatId, botName)
                            await bot.sendMessage(
                                chatId,
                                result.title,
                                {
                                    reply_markup: {
                                        inline_keyboard: result.content,
                                        resize_keyboard: true
                                    }, parse_mode: 'HTML'
                                }
                            )
                        } else if (msg.text) {
                            const refResult = await commands.addreferral(chatId, msg.text, botName)
                            if (refResult.flag) {
                                result = await commands.welcome(chatId, botName)
                                await bot.sendMessage(
                                    chatId,
                                    result.title,
                                    {
                                        reply_markup: {
                                            inline_keyboard: result.content,
                                            resize_keyboard: true
                                        }, parse_mode: 'HTML'
                                    }
                                )
                            } else {
                                await bot.sendMessage(
                                    chatId,
                                    "Invalid referral link"
                                )
                            }
                        }
                        return
                    })
                } else {
                    result = await commands.welcome(chatId, botName)
                    await bot.sendMessage(
                        chatId,
                        result.title,
                        {
                            reply_markup: {
                                inline_keyboard: result.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        }
                    )

                }
                break;

            case `/settings`:
                await bot.deleteMessage(chatId, msgId)
                result = await commands.settings(chatId)
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )
                break;

            case '/wallet':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.wallet(chatId)

                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case '/buy':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.buy()
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                bot.once(`message`, async (msg) => {
                    result = await commands.getTokenInfo(chatId, msg.text!, 'buy')
                    if (result) await bot.sendMessage(
                        chatId,
                        result.caption,
                        {
                            reply_markup: {
                                inline_keyboard: result.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        },

                    )
                    else {
                        const issue = commands.invalid('inputBuyTokenAddress')
                        await bot.sendMessage(chatId, issue.title, {
                            reply_markup: {
                                inline_keyboard: issue.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        })
                    }
                    return
                })
                break

            case '/sell':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.sell(chatId)
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break
            case '/leaderboard':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.leaderBoard()
                bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    })
                break

            case '/referral':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.refer(chatId)
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case '/help':
                await bot.deleteMessage(chatId, msgId)
                result = commands.help()
                await bot.sendMessage(
                    chatId,
                    result
                )

                break

            default:
                break
        }
    } catch (e) {
        console.log('error -> \n', e)
        const issue = commands.invalid('internal')
        await bot.sendMessage(chatId, issue.title, {
            reply_markup: {
                inline_keyboard: issue.content,
                resize_keyboard: true
            }, parse_mode: 'HTML'
        })
    }
});

bot.on('callback_query', async (query: CallbackQuery) => {
    const chatId = query.message?.chat.id!
    const msgId = query.message?.message_id!
    const action = query.data!
    const username = query.message?.chat?.username!
    const callbackQueryId = query.id;

    console.log(`query : ${chatId} -> ${action}`)
    try {
        let result
        switch (action) {
            case 'import':
                await bot.deleteMessage(chatId, msgId)
                const inputmsg = await bot.sendMessage(
                    chatId,
                    `Please input your private key`
                )

                bot.once(`message`, async (msg) => {
                    await bot.deleteMessage(chatId, inputmsg.message_id)
                    await bot.deleteMessage(chatId, msg.message_id)
                    result = await commands.importWallet(chatId, msg.text!, botName)
                    await bot.sendMessage(
                        chatId,
                        result.title,
                        {
                            reply_markup: {
                                inline_keyboard: result.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        }
                    )
                    return
                })

                break

            case 'create':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.createWallet(chatId, botName)
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )
                break

            case 'buy':
                await bot.sendMessage(
                    chatId,
                    (await commands.buy()).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.buy()).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                bot.once(`message`, async (msg) => {
                    const result = await commands.getTokenInfo(chatId, msg.text!, 'buy')
                    if (result) await bot.sendMessage(
                        chatId,
                        result.caption,
                        {
                            reply_markup: {
                                inline_keyboard: result.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        },

                    )
                    else {
                        const issue = commands.invalid('inputBuyTokenAddress')
                        await bot.sendMessage(chatId, issue.title, {
                            reply_markup: {
                                inline_keyboard: issue.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        })
                    }
                    return
                })

                break

            case 'sell':
                result = await commands.sell(chatId)
                await bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'wallet':
                await bot.sendMessage(
                    chatId,
                    (await commands.wallet(chatId)).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.wallet(chatId)).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'reset':
                await bot.sendMessage(
                    chatId,
                    (await commands.confirm('resetWallet')).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.confirm('resetWallet')).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'export':
                await bot.sendMessage(
                    chatId,
                    (await commands.confirm('exportKey')).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.confirm('exportKey')).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'show':
                await bot.sendMessage(
                    chatId,
                    (await commands.showKey(chatId)).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.showKey(chatId)).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'refer':
                await bot.sendMessage(
                    chatId,
                    (await commands.refer(chatId)).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.refer(chatId)).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )

                break

            case 'settings':
                await bot.sendMessage(
                    chatId,
                    (await commands.settings(chatId)).title,
                    {
                        reply_markup: {
                            inline_keyboard: (await commands.settings(chatId)).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )
                break

            case 'refresh':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.refresh(chatId)
                bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    })

                break

            case 'refreshwallet':
                await bot.deleteMessage(chatId, msgId)
                result = await commands.refreshWallet(chatId)
                bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    })

                break

            case 'leaderboard':
                result = await commands.leaderBoard()
                bot.sendMessage(
                    chatId,
                    result.title,
                    {
                        reply_markup: {
                            inline_keyboard: result.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    })
                break

            case 'pin':
                await bot.editMessageReplyMarkup(
                    {
                        inline_keyboard: (await commands.welcome(chatId, botName, true)).content
                    },
                    {
                        chat_id: chatId,
                        message_id: msgId
                    }
                )
                await bot.pinChatMessage(chatId, msgId)
                break

            case 'unpin':
                await bot.editMessageReplyMarkup(
                    {
                        inline_keyboard: (await commands.welcome(chatId, botName, false)).content
                    },
                    {
                        chat_id: chatId,
                        message_id: msgId
                    }
                )
                await bot.unpinChatMessage(chatId)
                break

            case 'priority':
            case 'announcement':
                await bot.editMessageReplyMarkup(
                    {
                        inline_keyboard: (await commands.newSettings(chatId, action)).content
                    },
                    {
                        chat_id: chatId,
                        message_id: msgId
                    }
                )
                break

            case 'buy1':
            case 'buy2':
            case 'sell1':
            case 'sell2':
            case 'slippage1':
            case 'slippage2':
            case 'priorityAmount':
                if (action == 'buy1' || action == 'buy2') editText = `Reply with your new setting for the ${action == 'buy1' ? 'left' : 'right'} Buy Button in SOL. Example: 0.5`
                else if (action == 'sell1' || action == 'sell2') editText = `Reply with your new setting for the ${action == 'sell1' ? 'left' : 'right'} Sell Button in % (0 - 100%). Example: 100`
                else if (action == 'slippage1' || action == 'slippage2') editText = `Reply with your new slippage setting for ${action == 'slippage1' ? 'buys' : 'sells'} in % (0.00 - 100.00%). Example: 5.5`
                else if (action == 'priorityAmount') editText = `Reply with your new Transaction Priority Setting for sells in SOL. Example: 0.0001`

                const desc = await bot.sendMessage(
                    chatId,
                    editText)

                bot.once(`message`, async (msg) => {
                    await bot.deleteMessage(chatId, msg.message_id)
                    await bot.deleteMessage(chatId, desc.message_id)
                    await bot.editMessageReplyMarkup(
                        {
                            inline_keyboard: (await commands.newSettings(chatId, action, msg.text)).content
                        },
                        {
                            chat_id: chatId,
                            message_id: msgId
                        }
                    )

                    return
                })

                break

            case 'help':
                result = commands.help()
                await bot.sendMessage(
                    chatId,
                    result
                )
                break

            case 'cancel':
                await bot.deleteMessage(chatId, msgId)
                break

            default:
                break
        }

        if (action.startsWith('buyS') || action.startsWith('buyL') || action.startsWith('buyX')) {
            const address = action.split(':')[1]
            const method = action.split(':')[0]
            if (method == 'buyX') {
                await bot.sendMessage(
                    chatId,
                    commands.inputBuyAmount().title,
                    {
                        reply_markup: {
                            inline_keyboard: (commands.inputBuyAmount()).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )
                bot.once('message', async (msg: any) => {
                    if (isNaN(Number(msg.text)) || !Number(msg.text)) {
                        const issue = commands.invalid('inputTokenAmount')
                        await bot.sendMessage(chatId, issue.title, {
                            reply_markup: {
                                inline_keyboard: issue.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        })
                        return
                    }
                    const txConfirm = await bot.sendMessage(chatId, 'Transaction sent. Confirming now...')
                    const tx = await commands.swapTokens(chatId, msg.text!, address, 'buy')
                    bot.deleteMessage(chatId, txConfirm.message_id)
                    bot.sendMessage(chatId,
                        tx.title, {
                        reply_markup: {
                            inline_keyboard: tx.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                    )
                })
            } else {
                const txConfirm = await bot.sendMessage(chatId, 'Transaction sent. Confirming now...')
                const tx = await commands.swapTokens(chatId, method, address, 'buy')
                bot.deleteMessage(chatId, txConfirm.message_id)
                bot.sendMessage(chatId,
                    tx.title, {
                    reply_markup: {
                        inline_keyboard: tx.content,
                        resize_keyboard: true
                    }, parse_mode: 'HTML'
                }
                )
            }

        } else if (action.startsWith('sell:')) {
            const address = action.split(':')[1]
            const result = await commands.getTokenInfo(chatId, address, 'sell')
            if (result) await bot.sendMessage(
                chatId,
                result.caption,
                {
                    reply_markup: {
                        inline_keyboard: result.content,
                        resize_keyboard: true
                    }, parse_mode: 'HTML'
                },
            )
        } else if (action.startsWith('sellS') || action.startsWith('sellL') || action.startsWith('sellX')) {
            const method = action.split(':')[0]
            const address = action.split(':')[1]
            if (method == 'sellX') {
                await bot.sendMessage(
                    chatId,
                    commands.inputSellAmount().title,
                    {
                        reply_markup: {
                            inline_keyboard: (commands.inputSellAmount()).content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                )
                bot.once('message', async (msg: any) => {
                    if (isNaN(Number(msg.text)) || !Number(msg.text)) {
                        const issue = commands.invalid('inputTokenAmount')
                        await bot.sendMessage(chatId, issue.title, {
                            reply_markup: {
                                inline_keyboard: issue.content,
                                resize_keyboard: true
                            }, parse_mode: 'HTML'
                        })
                        return
                    }
                    const txConfirm = await bot.sendMessage(chatId, 'Transaction sent. Confirming now...')
                    const tx = await commands.swapTokens(chatId, msg.text!, address, 'sell')
                    bot.deleteMessage(chatId, txConfirm.message_id)
                    bot.sendMessage(chatId,
                        tx.title, {
                        reply_markup: {
                            inline_keyboard: tx.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    }
                    )
                })
            } else {
                const txConfirm = await bot.sendMessage(chatId, 'Transaction sent. Confirming now...')
                const tx = await commands.swapTokens(chatId, method, address, 'sell')
                bot.deleteMessage(chatId, txConfirm.message_id)
                bot.sendMessage(chatId,
                    tx.title, {
                    reply_markup: {
                        inline_keyboard: tx.content,
                        resize_keyboard: true
                    }, parse_mode: 'HTML'
                }
                )
            }
        } else if (action.startsWith('limitB')) {
            const address = action.split(':')[1]
            await bot.sendMessage(
                chatId,
                'Please input token price as USD'
            )
            let price: number = 0
            bot.once('message', async (msg) => {
                if (isNaN(Number(msg.text)) || !Number(msg.text)) {
                    const issue = commands.invalid('inputTokenPrice')
                    await bot.sendMessage(chatId, issue.title, {
                        reply_markup: {
                            inline_keyboard: issue.content,
                            resize_keyboard: true
                        }, parse_mode: 'HTML'
                    })
                    return
                } else {
                    price = Number(msg.text)
                    await bot.sendMessage(
                        chatId,
                        'Please input INJ amount to buy'
                    )
                    let amount: number = 0
                    bot.once('message', async (msg) => {
                        if (isNaN(Number(msg.text)) || !Number(msg.text)) {
                            const issue = commands.invalid('inputTokenAmount')
                            await bot.sendMessage(chatId, issue.title, {
                                reply_markup: {
                                    inline_keyboard: issue.content,
                                    resize_keyboard: true
                                }, parse_mode: 'HTML'
                            })
                            return
                        } else {
                            amount = Number(msg.text)
                            const flag = await addPlaceOrder(chatId, price, amount, address, 'buy')
                            if (flag) await bot.sendMessage(
                                chatId,
                                'Successfully ordered'
                            )
                            else await bot.sendMessage(
                                chatId,
                                'Ordered failed, Try again'
                            )
                        }
                    })
                }
            })
        }

    } catch (e) {
        console.log('error -> \n', e)
        const issue = commands.invalid('internal')
        await bot.sendMessage(chatId, issue.title, {
            reply_markup: {
                inline_keyboard: issue.content
            }, parse_mode: 'HTML'
        })
    }

})

// await bot.answerCallbackQuery(callbackQueryId, { text: 'Input Token address to buy' })
