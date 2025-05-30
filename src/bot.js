// bot.js
import {
  fetchIPData,
  createProtocolInlineKeyboard,
  generateConfig
} from './cek.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.message) {
      return await this.handleMessage(update.message);
    } else if (update.callback_query) {
      return await this.handleCallbackQuery(update.callback_query);
    }
    return new Response('OK', { status: 200 });
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    if (text === '/start') {
      await this.sendMessage(chatId, 'Kirim IP dengan format IP:PORT, contoh: 103.102.231.103:2053');
      return new Response('OK', { status: 200 });
    }

    // Parse IP dan port, default port 443 kalau tidak dikirim
    let [ip, port] = text.split(':');
    if (!port) port = '443';

    // Fetch data IP
    const ipData = await fetchIPData(ip, port);
    if (!ipData) {
      await this.sendMessage(chatId, 'Maaf, data tidak ditemukan atau format salah.');
      return new Response('OK', { status: 200 });
    }

    // Kirim data IP dan tombol protokol
    await this.sendMessage(
      chatId,
      `Data untuk IP ${ip}:${port}:\nISP: ${ipData.isp}\nCountry: ${ipData.country}`,
      {
        reply_markup: createProtocolInlineKeyboard(ip, port)
      }
    );

    return new Response('OK', { status: 200 });
  }

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data; // contoh: "PROTOCOL|VLESS|103.102.231.103|2053"

    // Parse callback data
    const parts = data.split('|');
    if (parts.length !== 4 || parts[0] !== 'PROTOCOL') {
      // Kirim alert error ke user
      await this.answerCallbackQuery(callbackQuery.id, 'Data tidak valid.');
      return new Response('OK', { status: 200 });
    }

    const [, protocol, ip, port] = parts;

    // Generate config sesuai protocol, ip, port
    const configText = generateConfig(protocol, ip, port);

    // Kirim config ke chat user
    await this.sendMessage(chatId, `Config ${protocol} untuk ${ip}:${port}:\n\n${configText}`);

    // Kirim alert sukses di tombol
    await this.answerCallbackQuery(callbackQuery.id, 'Config sudah dikirim.');

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return response.json();
  }

  async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return response.json();
  }
}
