import { randomip } from './randomip.js';

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

      if (text.startsWith('/randomip')) {
        await this.sendMessage(chatId, '⏳ Mengambil IP proxy acak...');
        const { text: resultText, buttons } = await randomip(userId, 1);
        await this.sendMessage(chatId, resultText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } else {
        await this.sendMessage(chatId, 'Gunakan perintah /randomip untuk mengambil IP proxy acak.');
      }

    } else if (callback) {
      const { data, message, from, id: callbackId } = callback;

      if (data.startsWith('PAGE_')) {
        const page = parseInt(data.split('_')[1], 10);
        const { text, buttons } = await randomip(from.id, page);

        // Edit pesan inline keyboard (paging)
        await this.editMessageReplyMarkup(message.chat.id, message.message_id, buttons);
        await this.answerCallback(callbackId);
      }
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

  async answerCallback(callbackId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: false
      })
    });
  }

  async editMessageReplyMarkup(chatId, messageId, inlineKeyboard) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: inlineKeyboard }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
