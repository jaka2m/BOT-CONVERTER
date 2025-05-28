import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

      const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

      if (!ipPortPattern.test(text.trim())) {
        await this.sendMessage(chatId, 'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy.');
        return new Response('OK', { status: 200 });
      }

      const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

      const result = await checkProxyIP(text.trim());

      // Hapus loading
      await this.deleteMessage(chatId, loadingMsg.result.message_id);

      if (result.status === 'ACTIVE' && result.buttons && result.buttons.length > 0) {
        // Kirim info + tombol inline
        await this.sendMessage(chatId, result.infoMessage, {
          reply_markup: {
            inline_keyboard: result.buttons
          }
        });
      } else {
        // Jika error atau tidak aktif
        await this.sendMessage(chatId, `Status: ${result.status}`);
      }

      return new Response('OK', { status: 200 });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const [type, payload] = callback.data.split('|');

      if (type === 'back') {
        // Hapus pesan tombol dan kirim pesan awal
        await this.deleteMessage(chatId, messageId);
        await this.sendMessage(chatId, 'Kirim IP atau IP:PORT untuk cek status proxy.');
        return new Response('OK', { status: 200 });
      }

      // Untuk semua jenis link (vless_tls, trojan_ntls, vmess_tls, ss_ntls, dll)
      if (payload) {
        await this.answerCallbackQuery(callback.id, `Config: ${type.toUpperCase().replace('_', ' ')}`);
        // Kirim konfigurasi link
        await this.sendMessage(chatId, payload);
        return new Response('OK', { status: 200 });
      }
    }
  }

  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: extra.parse_mode || 'Markdown',
        reply_markup: extra.reply_markup || undefined
      })
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    return response.json();
  }

  async answerCallbackQuery(callbackQueryId, text) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false
      })
    });
    return response.json();
  }
}
