import {
  vpncf,
  createProtocolInlineKeyboard,
  createInitialWildcardInlineKeyboard,
  createWildcardOptionsInlineKeyboard,
  generateConfig,
  handleIpMessage
} from './cekvpn.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/check')) {
      const parts = text.split(' ');
      if (parts.length < 3) {
        return this.sendMessage(chatId, "Format: /check <ip> <port>");
      }
      const ip = parts[1];
      const port = parts[2];
      const API_URL = 'https://ip-api.com/json/'; // Ganti sesuai API Anda

      const responseText = await handleIpMessage(ip, port, API_URL);
      return this.sendMessage(chatId, responseText);
    }

    return this.sendMessage(chatId, "Perintah tidak dikenali.");
  }

  async handleCallbackQuery(callbackQuery) {
    const { id, data, message } = callbackQuery;
    const chatId = message.chat.id;

    // Format data callback: PROTOCOL|VLESS|ip|port, WILDCARD|VLESS|ip|port|wildcard, etc
    const parts = data.split('|');
    const action = parts[0];

    switch (action) {
      case 'PROTOCOL': {
        // User pilih protocol
        // data format: PROTOCOL|<protocol>|<ip>|<port>
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        // Tampilkan pilihan wildcard
        const keyboard = createInitialWildcardInlineKeyboard(ip, port, protocol);

        await this.editMessage(chatId, message.message_id, `Pilih opsi wildcard untuk protokol *${protocol}*`, keyboard);
        return this.answerCallbackQuery(id);
      }
      case 'SHOW_WILDCARD': {
        // Tampilkan list wildcard
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        const keyboard = createWildcardOptionsInlineKeyboard(ip, port, protocol);
        await this.editMessage(chatId, message.message_id, 'Pilih wildcard:', keyboard);
        return this.answerCallbackQuery(id);
      }
      case 'WILDCARD': {
        // User pilih wildcard tertentu
        // WILDCARD|protocol|ip|port|wildcardKey
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];
        const wildcardKey = parts[4];

        const API_URL = 'https://ip-api.com/json/'; // Ganti sesuai API Anda
        const configData = await vpncf(ip, port, API_URL);

        if (!configData) {
          await this.answerCallbackQuery(id, { text: "Gagal mengambil data IP." });
          return;
        }

        const configText = generateConfig(configData, protocol, 'example.com', wildcardKey);

        // Kirim config baru sebagai pesan, hapus pesan sebelumnya
        await this.sendMessage(chatId, configText);
        await this.deleteMessage(chatId, message.message_id);

        return this.answerCallbackQuery(id);
      }
      case 'NOWILDCARD': {
        // User pilih tanpa wildcard
        // NOWILDCARD|protocol|ip|port
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        const API_URL = 'https://ip-api.com/json/'; // Ganti sesuai API Anda
        const configData = await vpncf(ip, port, API_URL);

        if (!configData) {
          await this.answerCallbackQuery(id, { text: "Gagal mengambil data IP." });
          return;
        }

        const configText = generateConfig(configData, protocol, 'example.com');

        await this.sendMessage(chatId, configText);
        await this.deleteMessage(chatId, message.message_id);

        return this.answerCallbackQuery(id);
      }
      case 'BACK': {
        // Kembali ke pilihan protokol
        const ip = parts[1];
        const port = parts[2];

        const keyboard = createProtocolInlineKeyboard(ip, port);
        await this.editMessage(chatId, message.message_id, 'Pilih protokol:', keyboard);
        return this.answerCallbackQuery(id);
      }
      default:
        return this.answerCallbackQuery(id, { text: 'Aksi tidak dikenali.' });
    }
  }

  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...extra
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async editMessage(chatId, messageId, text, replyMarkup = null) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = {
      chat_id: chatId,
      message_id: messageId
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = {
      callback_query_id: callbackQueryId,
      ...options
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }
}
