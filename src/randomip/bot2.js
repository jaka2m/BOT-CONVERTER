import {
  handleRandomIpCommand,
  handleCallbackQuery,
} from './randomip.js';

export async function botku(link) {
  console.log("Bot link:", link);
}

export class TelegramBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }


  // 1. Proses setiap update yang masuk
  async handleUpdate(update) {
    // 1.1 Jika ada callback_query (tombol inline diklik)
    if (update.callback_query) {
      await handleCallbackQuery(this, update.callback_query);
      return new Response('OK');
    }

    // 1.2 Jika bukan message, abaikan
    if (!update.message) return new Response('OK');

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // 1.3 Jika user kirim "/proxy", panggil handler
    if (text === '/proxy') {
      await handleRandomIpCommand(this, chatId);
    }

    return new Response('OK');
  }

  // 2. Kirim pesan teks (sendMessage)
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  // 3. Edit reply_markup (keyboard) pada message
  async editMessageReplyMarkup({ chat_id, message_id, reply_markup }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = { chat_id, message_id, reply_markup };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  // 4. Jawab callback_query (beri tanda bahwa bot sudah menanganinya)
  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  // 5. Kirim file .txt (sendDocument)
  async sendDocument(chatId, filePath, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;

    const formData = new FormData();
    formData.append('chat_id', chatId);
    // Untuk Bun.js gunakan Bun.file(); 
    // Jika menggunakan Node.js, ganti sesuai library (misal: fs.createReadStream(filePath))
    formData.append('document', Bun.file(filePath));
    if (options.caption) formData.append('caption', options.caption);
    if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  }
}
