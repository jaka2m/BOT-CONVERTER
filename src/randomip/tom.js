import { randomip } from './randomip.js';

export async function jamur(update) {
  if (update.callback_query) {
    const callback = update.callback_query;
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;

    await handleCallback({
      callback,
      sendMessage: this.sendMessage.bind(this),
      answerCallback: this.answerCallback.bind(this),
      editMessageReplyMarkup: this.editMessageReplyMarkup.bind(this),
      token: this.token,
      apiUrl: this.apiUrl
    });
  } else if (update.message) {
    const text = update.message.text || '';
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;

    await handleCommand({
      text,
      chatId,
      userId,
      sendMessage: this.sendMessage.bind(this)
    });
  }

  return new Response('OK', { status: 200 });
}
