import {
  fetchIPData,
  createProtocolInlineKeyboard,
  createInitialWildcardInlineKeyboard,
  createWildcardOptionsInlineKeyboard,
  generateConfig
} from './cek.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
    return response.json();
  }

  async handleUpdate(update) {
    // Jika pesan dari chat biasa
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

      // Contoh basic reply, sesuaikan dengan kebutuhan
      if (text === '/start') {
        await this.sendMessage(chatId, 'Selamat datang! Kirim IP untuk cek data.');
      } else {
        // Bisa tambah logika fetchIPData misal
        const ipData = await fetchIPData(text);
        if (ipData) {
          await this.sendMessage(chatId, `Data untuk IP ${text}:\nISP: ${ipData.isp}\nCountry: ${ipData.country}`);
        } else {
          await this.sendMessage(chatId, 'Maaf, data tidak ditemukan atau input salah.');
        }
      }

      return new Response('OK', { status: 200 });
    }

    // Jika update adalah callback_query (tekan tombol inline)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const { data, id } = callbackQuery;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const parts = data.split('|');
      const action = parts[0];

      if (action === 'PROTOCOL') {
        const [, protocol, ip, port] = parts;
        await this.editMessageText(
          chatId,
          messageId,
          `*${protocol}*\nPilih mode wildcard untuk konfigurasi:`,
          {
            parse_mode: 'Markdown',
            reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol)
          }
        );
        await this.answerCallbackQuery(id);
        return new Response('OK', { status: 200 });
      }

      if (action === 'SHOW_WILDCARD') {
        const [, protocol, ip, port] = parts;
        await this.editMessageText(
          chatId,
          messageId,
          `Pilih wildcard untuk protokol ${protocol}:`,
          {
            parse_mode: 'Markdown',
            reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
          }
        );
        await this.answerCallbackQuery(id);
        return new Response('OK', { status: 200 });
      }

      if (action === 'NOWILDCARD') {
        const [, protocol, ip, port] = parts;
        // Kalau kamu perlu ambil data tambahan dari somewhere, pastikan tersedia, contoh:
        // const tempData = ... (harus kamu atur di kelas ini / global / parameter)
        const tempData = {}; // Contoh, kamu perlu simpan data sebelumnya untuk ip/isp dll

        const config = {
          ip,
          port,
          isp: tempData.isp || 'unknown',
          latitude: tempData.latitude || 'unknown',
          longitude: tempData.longitude || 'unknown'
        };
        const result = generateConfig(config, protocol, null);
        await this.editMessageText(chatId, messageId, result, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        await this.answerCallbackQuery(id);
        return new Response('OK', { status: 200 });
      }

      if (action === 'WILDCARD') {
        const [, protocol, ip, port, wildcardKey] = parts;
        const tempData = {}; // Sama seperti di atas, sesuaikan penyimpanan datamu

        const config = {
          ip,
          port,
          isp: tempData.isp || 'unknown',
          latitude: tempData.latitude || 'unknown',
          longitude: tempData.longitude || 'unknown'
        };
        const result = generateConfig(config, protocol, wildcardKey);
        await this.editMessageText(chatId, messageId, result, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        await this.answerCallbackQuery(id);
        return new Response('OK', { status: 200 });
      }

      if (action === 'BACK') {
        const [, ip, port] = parts;
        await this.editMessageText(chatId, messageId, '*Pilih jenis protokol yang ingin digunakan:*', {
          parse_mode: 'Markdown',
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });
        await this.answerCallbackQuery(id);
        return new Response('OK', { status: 200 });
      }
    }

    // Kalau bukan message atau callback_query, cukup respon OK
    return new Response('OK', { status: 200 });
  }
}
