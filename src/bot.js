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
        await this.sendMessage(chatId, 'Kirim IP atau IP:PORT untuk cek proxy.');
        return new Response('OK', { status: 200 });
      }

      const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');
      const result = await checkProxyIP(text.trim());

      await this.deleteMessage(chatId, loadingMsg.result.message_id);

      if (result.status !== 'ACTIVE') {
        await this.sendMessage(chatId, `Status Proxy: ${result.status}`);
        return new Response('OK', { status: 200 });
      }

      const buttons = [
        [{ text: 'VLESS', callback_data: `vless|${text.trim()}` }],
        [{ text: 'Trojan', callback_data: `trojan|${text.trim()}` }],
        [{ text: 'VMess', callback_data: `vmess|${text.trim()}` }],
        [{ text: 'Shadowsocks', callback_data: `ss|${text.trim()}` }],
        [{ text: 'Back', callback_data: 'back' }],
      ];

      this.cache = this.cache || {};
      this.cache[text.trim()] = result.configText;

      await this.sendMessage(chatId, 'Pilih protokol:', buttons);
      return new Response('OK', { status: 200 });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const [action, data] = callback.data.split('|');

      await this.answerCallbackQuery(callback.id);

      if (action === 'back') {
        await this.editMessageText(chatId, messageId, 'Silakan kirim IP atau IP:PORT untuk cek proxy.');
        return new Response('OK', { status: 200 });
      }

      if (!data) {
        await this.editMessageText(chatId, messageId, 'Data tidak valid.');
        return new Response('OK', { status: 200 });
      }

      const configText = this.cache?.[data];
      if (!configText) {
        await this.editMessageText(chatId, messageId, 'Konfigurasi tidak ditemukan.');
        return new Response('OK', { status: 200 });
      }

      if (['vless', 'vmess', 'trojan', 'ss'].includes(action)) {
        const buttons = [
          [{ text: 'TLS', callback_data: `show|${action}-TLS|${data}` }],
          [{ text: 'Non-TLS', callback_data: `show|${action}-NTLS|${data}` }],
          [{ text: 'Back', callback_data: `back` }],
        ];
        await this.editMessageText(chatId, messageId, `Pilih mode koneksi untuk ${action.toUpperCase()}:`, buttons);
        return new Response('OK', { status: 200 });
      }

      if (action === 'show') {
        const [protoMode, ipPort] = data.split('|');
        const [proto, mode] = protoMode.split('-');
        const blockKey = `${proto.toUpperCase()}-${mode.toUpperCase()}`;

        const block = this.extractBlock(this.cache?.[ipPort], blockKey);
        const buttons = [[{ text: 'Back', callback_data: `${proto.toLowerCase()}|${ipPort}` }]];

        await this.editMessageText(chatId, messageId, block || 'Config tidak ditemukan.', buttons);
        return new Response('OK', { status: 200 });
      }
    }
  }

  extractBlock(text, label) {
    const regex = new RegExp("```" + label + "[\\s\\S]*?```", "i");
    const match = text.match(regex);
    return match ? match[0] : null;
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
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    }).then(res => res.json());
  }
}
