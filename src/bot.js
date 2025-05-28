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
      await this.deleteMessage(chatId, loadingMsg.result.message_id);

      if (result.status !== 'ACTIVE') {
        await this.sendMessage(chatId, `Status Proxy: ${result.status}`);
        return new Response('OK', { status: 200 });
      }

      const buttons = [
        [{ text: 'VLESS', callback_data: `vless|${text.trim()}` }],
        [{ text: 'VMess', callback_data: `vmess|${text.trim()}` }],
        [{ text: 'Trojan', callback_data: `trojan|${text.trim()}` }],
        [{ text: 'Shadowsocks', callback_data: `ss|${text.trim()}` }],
        [{ text: 'Back', callback_data: 'back' }],
      ];

      await this.sendMessage(chatId, 'Pilih protokol yang ingin ditampilkan konfigurasi:', buttons);
      return new Response('OK', { status: 200 });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const [action, ipPort] = callback.data.split('|');

      await this.answerCallbackQuery(callback.id);

      if (action === 'back') {
        await this.editMessageText(chatId, messageId, 'Silakan kirim IP atau IP:PORT untuk cek proxy.');
        return new Response('OK', { status: 200 });
      }

      if (!ipPort) {
        await this.editMessageText(chatId, messageId, 'Data tidak valid.');
        return new Response('OK', { status: 200 });
      }

      const result = await checkProxyIP(ipPort);

      if (result.status !== 'ACTIVE') {
        await this.editMessageText(chatId, messageId, `Status Proxy: ${result.status}`);
        return new Response('OK', { status: 200 });
      }

      const configs = this.parseConfigByProtocol(result.configText);

      if (!configs[action]) {
        await this.editMessageText(chatId, messageId, 'Config tidak ditemukan.');
        return new Response('OK', { status: 200 });
      }

      // TLS / Non-TLS buttons
      const tlsButtons = this.extractTLSButtons(configs[action], action, ipPort);

      await this.editMessageText(chatId, messageId, `Pilih versi TLS untuk *${action.toUpperCase()}*`, tlsButtons);
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  parseConfigByProtocol(configText) {
    const protocols = ['vless', 'trojan', 'vmess', 'ss'];
    const result = {};

    protocols.forEach(proto => {
      const regex = new RegExp("```" + proto.toUpperCase() + "[\\s\\S]*?```", "gi");
      const matches = [...configText.matchAll(regex)];
      if (matches.length > 0) {
        result[proto] = matches.map(m => m[0]); // array of TLS & Non-TLS
      }
    });

    return result;
  }

  extractTLSButtons(configBlocks, proto, ipPort) {
    const buttons = configBlocks.map((block, i) => {
      const isTLS = block.toLowerCase().includes('tls') ? 'TLS' : 'Non-TLS';
      return [{
        text: `${isTLS}`,
        callback_data: `showconfig|${proto}|${ipPort}|${i}`
      }];
    });

    buttons.push([{ text: 'Back', callback_data: `back` }]);
    return buttons;
  }

  async showConfig(proto, ipPort, index, chatId, messageId) {
    const result = await checkProxyIP(ipPort);
    const configs = this.parseConfigByProtocol(result.configText);
    const configText = configs[proto]?.[index] || 'Config tidak ditemukan.';
    const buttons = [[{ text: 'Back', callback_data: `back` }]];
    await this.editMessageText(chatId, messageId, configText, buttons);
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
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    }).then(res => res.json());
  }
}
