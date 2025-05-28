import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return { status: 200, body: 'OK' };
    if (update.message.from?.is_bot) return { status: 200, body: 'OK' };

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    const inputs = text.split(/[\s\n]+/).filter(Boolean);
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    for (const input of inputs) {
      if (!ipPortPattern.test(input)) {
        await this.sendMessage(chatId, `Format salah: ${input}\nFormat: IP atau IP:PORT (port default 443 jika tidak disertakan)`);
        continue;
      }

      // Kirim pesan loading dan simpan message_id-nya
      const loadingMsg = await this.sendMessage(chatId, `⏳ Memproses IP: ${input} ...`);

      // Proses cek IP
      const result = await checkProxyIP(input);

      // Hapus pesan loading
      await this.deleteMessage(chatId, loadingMsg.result.message_id);

      if (result.status === 'ACTIVE') {
        await this.sendMessage(chatId, result.configText);
      } else if (result.status === 'ERROR') {
        await this.sendMessage(chatId, `❌ Error cek IP: ${input}`);
      } else {
        await this.sendMessage(chatId, `⚠️ Proxy tidak aktif atau tidak valid: ${input}`);
      }
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

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
  }
}
