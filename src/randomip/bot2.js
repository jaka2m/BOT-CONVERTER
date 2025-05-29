import {
  handleRandomIpCommand,
  handleCallbackQuery,
} from './randomip.js';

export async function botku(link) {
console.log("Bot link:", link);
}

export class TelegramBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
  if (update.callback_query) {
    await handleCallbackQuery(this, update.callback_query);
    return new Response('OK', { status: 200 });
  }

  if (!update.message) return new Response('OK', { status: 200 });

  const chatId = update.message.chat.id;
  const text = update.message.text || '';

  if (text === '/proxy') {
  await handleRandomIpCommand(this, chatId);
}
  
  return new Response('OK', { status: 200 });
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
}
