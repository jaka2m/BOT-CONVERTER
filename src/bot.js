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

      // Kirim pesan loading
      const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

      // Lakukan pengecekan IP
      const result = await checkProxyIP(text.trim());

      // Hapus loading message
      await this.deleteMessage(chatId, loadingMsg.result.message_id);

      if (result.status !== 'ACTIVE') {
        await this.sendMessage(chatId, `Status Proxy: ${result.status}`);
        return new Response('OK', { status: 200 });
      }

      // Kirim pesan dengan tombol callback (5 tombol)
      const buttons = [
        [{ text: 'VLESS', callback_data: `vless|${text.trim()}` }],
        [{ text: 'Trojan', callback_data: `trojan|${text.trim()}` }],
        [{ text: 'VMess', callback_data: `vmess|${text.trim()}` }],
        [{ text: 'Shadowsocks', callback_data: `ss|${text.trim()}` }],
        [{ text: 'Back', callback_data: 'back' }],
      ];

      await this.sendMessage(chatId, 'Pilih protokol yang ingin ditampilkan konfigurasi:', buttons);

      return new Response('OK', { status: 200 });
    }

    // Handle callback query
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const [action, ipPort] = callback.data.split('|');

      // Jawab callback supaya loading hilang di client
      await this.answerCallbackQuery(callback.id);

      if (action === 'back') {
        await this.editMessageText(chatId, messageId, 'Silakan kirim IP atau IP:PORT untuk cek proxy.');
        return new Response('OK', { status: 200 });
      }

      if (!ipPort) {
        await this.editMessageText(chatId, messageId, 'Data tidak valid.');
        return new Response('OK', { status: 200 });
      }

      // Lakukan cek proxy
      const result = await checkProxyIP(ipPort);

      if (result.status !== 'ACTIVE') {
        await this.editMessageText(chatId, messageId, `Status Proxy: ${result.status}`);
        return new Response('OK', { status: 200 });
      }

      // Parse configText untuk masing2 protokol
      const configs = this.parseConfigByProtocol(result.configText);

      const selectedConfig = configs[action] || 'Config tidak ditemukan.';

      const buttonsBack = [
        [{ text: 'Back', callback_data: `back` }]
      ];

      await this.editMessageText(chatId, messageId, selectedConfig, buttonsBack);

      return new Response('OK', { status: 200 });
    }
  }

  parseConfigByProtocol(configText) {
    // configText adalah string besar, potong per protokol
    // Contoh pembatas ```VMESS-TLS ... ```
    const protocols = ['vless', 'trojan', 'vmess', 'ss'];

    const result = {};

    protocols.forEach(proto => {
      const regex = new RegExp("```" + proto.toUpperCase() + "[\\s\\S]*?```", "i");
      const match = configText.match(regex);
      if (match) {
        result[proto] = match[0];
      } else {
        result[proto] = 'Config tidak ditemukan.';
      }
    });

    return result;
  }

  async sendMessage(chatId, text, replyMarkup = null) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      body.reply_markup = { inline_keyboard: replyMarkup };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async editMessageText(chatId, messageId, text, replyMarkup = null) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      body.reply_markup = { inline_keyboard: replyMarkup };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    return response.json();
  }
}
