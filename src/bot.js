import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    if (!ipPortPattern.test(text.trim())) {
      await this.sendMessage(chatId, 'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy.');
      return new Response('OK', { status: 200 });
    }

    // Kirim pesan loading
    const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

    // Lakukan pengecekan IP
    const result = await checkProxyIP(text.trim());

    // Susun reply dengan markdown (preformatted)
    let reply = `Status pengecekan untuk ${text.trim()}:\n\n`;
    reply += `Status: ${result.status}\n`;
    
    if (result.status === 'ACTIVE' && result.configText) {
      reply += '```\n' + result.configText + '\n```';
    }

    // Hapus  loading
    await this.deleteMessage(chatId, loadingMsg.result.message_id);

    // Kirim hasil pengecekan
    await this.sendMessage(chatId, reply);

    return new Response('OK', { status: 200 });
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
}
