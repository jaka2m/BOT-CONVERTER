import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });

    // Jika callback query (tombol ditekan)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      // Data format: "action|ipPort"
      // contoh: "vless|1.2.3.4:443"
      const [action, ipPort] = data.split('|');

      // Jika tombol back
      if (action === 'back') {
        // Kirim pesan instruksi awal
        await this.editMessage(chatId, messageId, 
          'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy dan pilih konfigurasi.', 
          this.getMainKeyboard(ipPort)
        );
        // Jawab callback agar loading hilang
        await this.answerCallback(callback.id);
        return new Response('OK', { status: 200 });
      }

      // Jalankan cek proxy
      const result = await checkProxyIP(ipPort);
      if (result.status !== 'ACTIVE') {
        await this.answerCallback(callback.id, 'Proxy tidak aktif atau format salah');
        return new Response('OK', { status: 200 });
      }

      // Edit pesan untuk menampilkan konfigurasi dengan dua blok kode terpisah TLS dan Non-TLS
await this.editMessage(
  chatId,
  messageId,
  `Konfigurasi untuk \`${ipPort}\`:\n\n` +
  '```TLS\n' +
  `${this.getTLSConfig(result, action)}\n` +
  '```\n\n' +
  '```Non-TLS\n' +
  `${this.getNonTLSConfig(result, action)}\n` +
  '```',
  this.getConfigKeyboard(ipPort)
);

      // Jawab callback untuk hilangkan loading
      await this.answerCallback(callback.id);
      return new Response('OK', { status: 200 });
    }

    // Jika pesan biasa (input IP)
    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    if (!ipPortPattern.test(text.trim())) {
      await this.sendMessage(chatId, 'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy.');
      return new Response('OK', { status: 200 });
    }

    // Kirim pesan loading
    const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

    // Edit pesan loading ke menu tombol pilihan
    await this.editMessage(chatId, loadingMsg.result.message_id,
      `Pilih konfigurasi untuk \`${text.trim()}\`:`,
      this.getMainKeyboard(text.trim())
    );

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
    if (replyMarkup) body.reply_markup = replyMarkup;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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
    if (replyMarkup) body.reply_markup = replyMarkup;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async answerCallback(callbackQueryId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = {
      callback_query_id: callbackQueryId,
      text,
      show_alert: text ? true : false,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }
}
