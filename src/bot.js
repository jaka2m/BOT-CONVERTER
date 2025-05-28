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

      // Simpan configText di memori sederhana (bisa juga pake DB/cache)
      this._lastConfigText = result.configText;
      this._lastIpPort = text.trim();

      // Kirim tombol pilih protokol
      const buttons = [
        [{ text: 'VLESS', callback_data: `proto|vless` }],
        [{ text: 'Trojan', callback_data: `proto|trojan` }],
        [{ text: 'VMess', callback_data: `proto|vmess` }],
        [{ text: 'Shadowsocks', callback_data: `proto|ss` }],
      ];

      await this.sendMessage(chatId, `Proxy aktif: ${this._lastIpPort}\nPilih protokol yang ingin ditampilkan konfigurasi:`, buttons);

      return new Response('OK', { status: 200 });
    }

    // Handle callback query
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      // Jawab callback supaya loading hilang di client
      await this.answerCallbackQuery(callback.id);

      // Back button dari mana saja ke awal input
      if (data === 'back_to_start') {
        await this.editMessageText(chatId, messageId, 'Silakan kirim IP atau IP:PORT untuk cek proxy.');
        this._lastConfigText = null;
        this._lastIpPort = null;
        return new Response('OK', { status: 200 });
      }

      // Kalau belum ada configText (misal restart bot), minta user input ulang
      if (!this._lastConfigText) {
        await this.editMessageText(chatId, messageId, 'Data konfigurasi tidak ditemukan. Silakan kirim IP atau IP:PORT lagi untuk cek proxy.');
        return new Response('OK', { status: 200 });
      }

      // Format callback: "proto|vless", "tls|vless|tls", "tls|vless|nontls"
      const parts = data.split('|');

      if (parts[0] === 'proto') {
        // Pilih protokol → tampil tombol TLS/Non-TLS
        const proto = parts[1];
        if (!['vless','trojan','vmess','ss'].includes(proto)) {
          await this.editMessageText(chatId, messageId, 'Protokol tidak valid.', [[{ text: 'Back', callback_data: 'back_to_start' }]]);
          return new Response('OK', { status: 200 });
        }

        const buttonsTls = [
          [{ text: 'TLS', callback_data: `tls|${proto}|tls` }],
          [{ text: 'Non-TLS', callback_data: `tls|${proto}|nontls` }],
          [{ text: 'Back', callback_data: 'back_to_start' }],
        ];

        await this.editMessageText(chatId, messageId, `Protokol: ${proto.toUpperCase()}\nPilih TLS atau Non-TLS:`, buttonsTls);
        return new Response('OK', { status: 200 });
      }

      if (parts[0] === 'tls') {
        const proto = parts[1];
        const tlsType = parts[2]; // "tls" atau "nontls"

        // Ambil configText berdasarkan protokol dan TLS/Non-TLS
        const config = this.extractConfig(this._lastConfigText, proto, tlsType);

        const buttonsBack = [
          [{ text: 'Pilih Protokol Lagi', callback_data: 'back_to_start' }],
        ];

        await this.editMessageText(chatId, messageId, config, buttonsBack);
        return new Response('OK', { status: 200 });
      }

      // Kalau data tidak dikenali
      await this.editMessageText(chatId, messageId, 'Perintah tidak dikenali.', [[{ text: 'Back', callback_data: 'back_to_start' }]]);
      return new Response('OK', { status: 200 });
    }
  }

  extractConfig(configText, proto, tlsType) {
    /*
      configText adalah string besar dengan blok:
      ```VLESS-TLS
      ...
      ```
      ```VLESS-NonTLS
      ...
      ```
      atau bisa juga hanya ```VLESS ... ``` tanpa suffix.

      Kita cari blok yang mengandung protokol dan TLS/NonTLS sesuai tlsType.

      tlsType = 'tls' → cari blok dengan -TLS (case insensitive)
      tlsType = 'nontls' → cari blok dengan -NonTLS atau tanpa -TLS (anggap non-tls)
    */

    // Normalisasi tlsType
    const tlsUpper = tlsType.toUpperCase();

    // Buat regex blok protokol dengan TLS/NonTLS
    // Misal: ```VLESS-TLS ... ```
    // atau ```VLESS-NonTLS ... ```
    // atau ```VLESS ... ```
    // Kita ambil semua blok ```...```
    const regexAllBlocks = /```([\w-]+)[\s\S]*?```/g;
    let match;
    let candidateBlocks = [];

    while ((match = regexAllBlocks.exec(configText)) !== null) {
      const header = match[1]; // Contoh: "VLESS-TLS" atau "VMESS-NonTLS" atau "TROJAN"
      const block = match[0];

      if (header.toLowerCase().startsWith(proto.toLowerCase())) {
        // Cek TLS atau Non-TLS sesuai tlsType
        if (tlsType === 'tls') {
          // Harus ada "-TLS" di header
          if (header.toUpperCase().includes('-TLS')) {
            candidateBlocks.push(block);
          }
        } else {
          // Non-TLS, blok yang tidak ada -TLS, atau ada -NonTLS
          if (!header.toUpperCase().includes('-TLS') || header.toUpperCase().includes('-NONTLS')) {
            candidateBlocks.push(block);
          }
        }
      }
    }

    if (candidateBlocks.length > 0) {
      return candidateBlocks.join('\n\n');
    }

    return 'Config tidak ditemukan untuk protokol dan tipe TLS/Non-TLS yang dipilih.';
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
