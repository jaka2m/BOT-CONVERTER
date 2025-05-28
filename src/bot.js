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

    // Cek apakah pesan berisi IP atau IP:PORT sederhana
    // Contoh valid: "8.8.8.8", "8.8.8.8:443"
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    if (!ipPortPattern.test(text.trim())) {
      // Jika bukan format IP:PORT, balas info instruksi
      await this.sendMessage(chatId, 'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy.');
      return new Response('OK', { status: 200 });
    }

    // Lakukan pengecekan IP
    const result = await checkProxyIP(text.trim());

    let reply = `Status pengecekan untuk ${text.trim()}:\n\n`;
    reply += `Status: ${result.status}\n`;
    reply += `Delay: ${result.delay}\n`;
    reply += `Country: ${result.country}\n`;
    reply += `ISP: ${result.isp}\n\n`;

    if (result.status === 'ACTIVE' && result.configText) {
      reply += `\`\`\`${result.configText}\`\`\``;
    }

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
        text: text
      })
    });
    return response.json();
  }
}
