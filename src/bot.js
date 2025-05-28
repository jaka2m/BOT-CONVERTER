import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    // Abaikan jika bukan message atau callback_query
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    // ======= HANDLE CALLBACK (TOMBOL) =======
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
          'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy dan pilih konfigurasi.',
          this.getMainKeyboard(ipPort)
        );
        await this.answerCallback(callback.id);
        return new Response('OK', { status: 200 });
      }

      const result = await checkProxyIP(ipPort);
      if (result.status !== 'ACTIVE') {
        await this.answerCallback(callback.id, 'Proxy tidak aktif atau format salah');
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
        `STATUS   :${result.status}\n` +
        `DELAY    :${result.delay}\n` +
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

    // ======= HANDLE PESAN MASUK =======
    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    // /start command
      if (text.startsWith('/start')) {
        const startMessage =
          'Selamat datang di *Stupid World Converter Bot!*\n\n' +
          'Gunakan perintah:\n' +
          '• `/converter` — untuk mengubah link proxy ke format:\n' +
          '  - Singbox\n  - Nekobox\n  - Clash\n\n' +
          '• `/randomip` — untuk mendapatkan 20 IP acak dari daftar proxy\n\n' +
          'Ketik `/converter` untuk info lebih lanjut.';
        await this.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

    // Command /converter
    if (text.startsWith('/converter')) {
      const infoMessage =
        '🧠 *Stupid World Converter Bot*\n\n' +
        'Kirimkan saya link konfigurasi V2Ray ATAU IP:PORT dan saya akan mengubahnya ke format:\n' +
        '- Singbox\n- Nekobox\n- Clash\n\n' +
        '*Contoh:*\n' +
        '`vless://...`\n' +
        '`104.21.75.43:443`\n\n' +
        '*Catatan:*\n- Maksimal 10 link atau IP per permintaan.';
      await this.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    // Cek apakah input berupa IP atau IP:PORT
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
    if (!ipPortPattern.test(text)) {
      // Abaikan jika bukan IP atau IP:PORT
      return new Response('OK', { status: 200 });
    }

    // Kirim pesan loading
    const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');
    // Edit pesan untuk pilih konfigurasi
    await this.editMessage(
      chatId,
      loadingMsg.result.message_id,
      `Pilih konfigurasi untuk \`${text}\`:`,
      this.getMainKeyboard(text)
    );

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(error);
    await this.sendMessage(chatId, `Error: ${error.message}`);
    return new Response('OK', { status: 200 });
  }
}

// Keyboard untuk main menu pilihan protokol
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

// Keyboard konfigurasi untuk kembali ke menu
getConfigKeyboard(ipPort) {
  return {
    inline_keyboard: [
      [
        { text: 'Kembali ke menu', callback_data: `back|${ipPort}` }
      ]
    ]
  };
}

// Mendapatkan konfigurasi TLS berdasarkan action
getTLSConfig(result, action) {
  switch (action) {
    case 'vless': return result.vlessTLSLink || '';
    case 'trojan': return result.trojanTLSLink || '';
    case 'vmess': return result.vmessTLSLink || '';
    case 'ss': return result.ssTLSLink || '';
    default: return '';
  }
}

// Mendapatkan konfigurasi Non-TLS berdasarkan action
getNonTLSConfig(result, action) {
  switch (action) {
    case 'vless': return result.vlessNTLSLink || '';
    case 'trojan': return result.trojanNTLSLink || '';
    case 'vmess': return result.vmessNTLSLink || '';
    case 'ss': return result.ssNTLSLink || '';
    default: return '';
  }
}

// Kirim pesan text
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

// Edit pesan text
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

// Jawab callback query
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
    body: JSON.stringify(body)
  });
  return response.json();
}

// Kirim file dokumen (contoh config)
async sendDocument(chatId, content, filename, mimeType) {
  const formData = new FormData();
  const blob = new Blob([content], { type: mimeType });
  formData.append('document', blob, filename);
  formData.append('chat_id', chatId.toString());

  const response = await fetch(
    `${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    }
  );

  return response.json();
}
}

