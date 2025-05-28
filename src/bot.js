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

    // Pisah pesan per spasi atau newline
    const inputs = text.split(/[\s\n]+/).filter(Boolean);

    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    // Proses satu per satu
    for (const input of inputs) {
      if (!ipPortPattern.test(input)) {
        await this.sendMessage(chatId, `Format salah: ${input}\nFormat: IP atau IP:PORT (port default 443 jika tidak disertakan)`);
        continue;
      }

      const result = await checkProxyIP(input);

      if (result.status === 'ACTIVE') {
        await this.sendMessage(chatId, result.configText);
      } else if (result.status === 'ERROR') {
        await this.sendMessage(chatId, `Error cek IP: ${input}`);
      } else {
        await this.sendMessage(chatId, `Proxy tidak aktif atau tidak valid: ${input}`);
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
}
