import { handleCommand } from './randomip/commandHandler.js';
import { handleCallback, answerCallback, editMessageReplyMarkup } from './randomip/callbackHandler.js';
import { randomip } from './randomip/randomip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const message = update.message;
    const callback = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';

      await handleCommand({ text, chatId, userId, sendMessage: this.sendMessage.bind(this) });

    } else if (callback) {
      await handleCallback({
        callback,
        sendMessage: this.sendMessage.bind(this),
        answerCallback: answerCallback.bind(this),
        editMessageReplyMarkup: editMessageReplyMarkup.bind(this),
        token: this.token,
        apiUrl: this.apiUrl
      });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      ...options
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
