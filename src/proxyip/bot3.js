import { handleProxyipCommand, handleCallbackQuery } from './proxyip.js';

export async function proxyBot(link) {
  console.log("Bot link:", link);
}

export class TelegramProxyBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Fungsi utama untuk menerima update webhook dari Telegram
  async handleUpdate(update) {
    // Tangani pesan biasa
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

      // Buat objek msg mirip struktur node-telegram-bot-api supaya handler compatible
      const msg = update.message;

      if (text.startsWith('/proxyip')) {
        // Jalankan handler command proxyip dengan this sebagai bot
        await handleProxyipCommand(this, msg);
      }
    }

    // Tangani callback_query dari inline button
    if (update.callback_query) {
      // Sesuaikan supaya handler menerima objek bot ini dan callbackQuery
      await handleCallbackQuery(this, update.callback_query);
    }

    // Balas Telegram supaya webhook tidak timeout
    return new Response('OK', { status: 200 });
  }

  // Fungsi untuk mengirim pesan ke chatId, support opsi tambahan
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;

    const body = {
      chat_id: chatId,
      text: text,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  // Kalau perlu fungsi lain seperti answerCallbackQuery bisa ditambahkan juga
  async answerCallbackQuery(callbackQueryId, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;

    const body = {
      callback_query_id: callbackQueryId,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }
}
