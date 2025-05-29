import { handleProxyipCommand, handleCallbackQuery } from './proxyip.js';

export async function proxyBot(link) {
  console.log("Bot link:", link);
}

export class TelegramProxyBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.message) {
      const msg = update.message;
      if (msg.text && msg.text.startsWith('/proxyip')) {
        await handleProxyipCommand(this, msg);
      }
    }

    if (update.callback_query) {
      await handleCallbackQuery(this, update.callback_query);
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId, ...options };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async editMessageReplyMarkup(replyMarkup, { chat_id, message_id }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = {
      chat_id,
      message_id,
      reply_markup: replyMarkup,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }
}
