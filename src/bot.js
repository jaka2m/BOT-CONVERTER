import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';
import { checkProxyIP, randomconfig } from './checkip.js';
import { rotateconfig } from './config.js';
import { handleCommand } from './commandHandler.js';
import { handleCallback, answerCallback, editMessageReplyMarkup } from './callbackHandler.js';
import { randomip } from './randomip.js';

const HOSTKU = 'example.com'; // Contoh host

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(request) {
    const body = await request.json();
    const message = body.message;
    const callback = body.callback_query;

    const chatId = message?.chat?.id || callback?.message?.chat?.id;
    const userId = message?.from?.id || callback?.from?.id;
    const text = message?.text || '';

    if (text) {
      // Handle command
      await handleCommand({
        text,
        chatId,
        userId,
        sendMessage: this.sendMessage.bind(this),
        sendMessageWithDelete: this.sendMessageWithDelete.bind(this),
        deleteMessage: this.deleteMessage.bind(this),
        generateClashConfig,
        generateNekoboxConfig,
        generateSingboxConfig,
        checkProxyIP,
        randomconfig,
        rotateconfig,
        HOSTKU
      });

    } else if (callback) {
      // Handle callback queries
      await handleCallback({
        callback,
        sendMessage: this.sendMessage.bind(this),
        answerCallback: answerCallback.bind(this),
        editMessageReplyMarkup: editMessageReplyMarkup.bind(this),
        token: this.token,
        apiUrl: this.apiUrl
      });
    }

    return new Response('OK', { status: 200 });
  }

  // Kirim pesan teks ke chat
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  // Kirim pesan dan kembalikan hasilnya untuk bisa dihapus
  async sendMessageWithDelete(chatId, text) {
    try {
      const res = await this.sendMessage(chatId, text);
      return res.result;
    } catch (e) {
      console.error('Gagal mengirim pesan loading:', e);
      return null;
    }
  }

  // Hapus pesan
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    return response.json();
  }

  // Kirim dokumen (file konfigurasi)
  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }
}
