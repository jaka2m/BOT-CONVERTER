import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { checkProxyIP } from './checkip.js';
import { randomconfig } from './randomconfig.js';
import { rotateconfig } from './config.js';
import { botku, TelegramBotku } from './randomip/bot2.js';
import { proxyBot, TelegramProxyBot } from './proxyip/bot3.js';

const HOSTKU = 'joss.checker-ip.xyz';

export class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      const [action, ipPort] = data.split('|');

      if (action === 'back') {
        await this.editMessage(
          chatId,
          messageId,
          `IP:PORT *${ipPort}*\nSilakan pilih salah satu jenis konfigurasi:`,
          this.getMainKeyboard(ipPort)
        );
        await this.answerCallback(callback.id);
        return new Response('OK', { status: 200 });
      }

      const result = await checkProxyIP(ipPort);
      if (result.status !== 'ACTIVE') {
        await this.editMessage(chatId, messageId, `❌ Proxy ${ipPort} tidak aktif.`, null);
        await this.answerCallback(callback.id);
        return new Response('OK', { status: 200 });
      }

      await this.editMessage(
        chatId,
        messageId,
        '```INFORMATION\n' +
        `IP       :${result.ip}\n` +
        `PORT     :${result.port}\n` +
        `ISP      :${result.isp}\n` +
        `COUNTRY  :${result.country}\n` +
        `DELAY    :${result.delay}\n` +
        `STATUS   :✅ ${result.status}\n` +
        '```' +
        '```TLS\n' +
        `${this.getTLSConfig(result, action)}\n` +
        '```' +
        '```Non-TLS\n' +
        `${this.getNonTLSConfig(result, action)}\n` +
        '```',
        this.getConfigKeyboard(ipPort)
      );

      await this.answerCallback(callback.id);
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    // ✅ Tangani /start
    if (text === '/start') {
      await this.sendMessage(chatId, `👋 Selamat datang di *Proxy Config Bot*!\n\nKirim IP:PORT untuk mengecek status dan mendapatkan link konfigurasi dalam berbagai format:\n\nContoh:\n\`123.456.789.0:443\``);
      return new Response('OK', { status: 200 });
    }

    // Tangani input IP:PORT
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
    if (ipPortPattern.test(text)) {
      const loading = await this.sendMessage(chatId, '⏳ Memeriksa proxy...');

      const result = await checkProxyIP(text);
      if (result.status !== 'ACTIVE') {
        await this.editMessage(chatId, loading.result.message_id, `❌ Proxy ${text} tidak aktif.`);
        return new Response('OK', { status: 200 });
      }

      await this.editMessage(
        chatId,
        loading.result.message_id,
        `✅ Proxy *${text}* aktif.\nPilih jenis konfigurasi:`,
        this.getMainKeyboard(text)
      );

      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  getTLSConfig(result, action) {
    switch (action) {
      case 'vless': return result.vlessTLSLink || '';
      case 'trojan': return result.trojanTLSLink || '';
      case 'vmess': return result.vmessTLSLink || '';
      case 'ss': return result.ssTLSLink || '';
      default: return '';
    }
  }

  getNonTLSConfig(result, action) {
    switch (action) {
      case 'vless': return result.vlessNTLSLink || '';
      case 'trojan': return result.trojanNTLSLink || '';
      case 'vmess': return result.vmessNTLSLink || '';
      case 'ss': return result.ssNTLSLink || '';
      default: return '';
    }
  }

  getMainKeyboard(ipPort) {
    return {
      inline_keyboard: [
        [
          { text: 'VLESS', callback_data: `vless|${ipPort}` },
          { text: 'TROJAN', callback_data: `trojan|${ipPort}` }
        ],
        [
          { text: 'VMESS', callback_data: `vmess|${ipPort}` },
          { text: 'SHADOWSOCKS', callback_data: `ss|${ipPort}` }
        ],
        [
          { text: 'BACK', callback_data: `back|${ipPort}` }
        ]
      ]
    };
  }

  getConfigKeyboard(ipPort) {
    return {
      inline_keyboard: [
        [
          { text: 'Kembali ke menu', callback_data: `back|${ipPort}` }
        ]
      ]
    };
  }

  async sendMessage(chatId, text, replyMarkup) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async editMessage(chatId, messageId, text, replyMarkup) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async answerCallback(callbackQueryId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = {
      callback_query_id: callbackQueryId,
      text,
      show_alert: !!text,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
