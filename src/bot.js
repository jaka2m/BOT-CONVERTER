import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return { status: 200, body: 'OK' };

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    // Cek apakah input adalah IP atau IP:port
    // Format IP biasa: x.x.x.x (1-3 digit per oktet)
    // Port optional setelah ":"
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    if (ipPortPattern.test(text)) {
      // langsung cek proxy
      const result = await checkProxyIP(text);

      if (result.status === 'ACTIVE') {
        await this.sendMessage(chatId, result.configText);
      } else if (result.status === 'ERROR') {
        await this.sendMessage(chatId, 'Terjadi kesalahan saat pengecekan IP.');
      } else {
        await this.sendMessage(chatId, 'Proxy tidak aktif atau tidak valid.');
      }
    } else {
      await this.sendMessage(chatId, 'Kirim pesan dengan format: IP atau IP:PORT (port default 443 jika tidak disertakan)');
    }

    return { status: 200, body: 'OK' };
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    return response.json();
  }
}
