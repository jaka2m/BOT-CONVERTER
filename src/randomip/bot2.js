import {
  handleRandomIpCommand,
  handleCallbackQuery,
  globalIpList,
} from './randomip.js';

export class TelegramBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      await handleCallbackQuery(this, update.callback_query);
      return new Response('OK');
    }

    if (!update.message) return new Response('OK');

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text === '/proxy') {
      await handleRandomIpCommand(this, chatId);
    }

    return new Response('OK');
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async editMessageReplyMarkup({ chat_id, message_id, reply_markup }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = { chat_id, message_id, reply_markup };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async sendDocument(chatId, filePath, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', Bun.file(filePath));
    if (options.caption) formData.append('caption', options.caption);
    if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
}
