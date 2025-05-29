import {
  handleRandomIpCommand,
  handleCallbackQuery,
} from './randomip.js';

import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      // Handle inline keyboard callback query (flag prev/next & cc)
      await handleCallbackQuery(this, update.callback_query);
      return new Response('OK', { status: 200 });
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId,
        '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox, dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nbaca baik-baik dulu sebelum nanya.');
    } 
    else if (text.startsWith('/randomip')) {
      // Panggil handler randomip (tombol flag, paging)
      await handleRandomIpCommand(this, chatId);
    }
    else if (text.includes('://')) {
      try {
        const links = text.split('\n').filter(line => line.trim().includes('://'));

        if (links.length === 0) {
          await this.sendMessage(chatId, 'No valid links found. Please send VMess, VLESS, Trojan, or Shadowsocks links.');
          return new Response('OK', { status: 200 });
        }

        // Generate configurations
        const clashConfig = generateClashConfig(links, true);
        const nekoboxConfig = generateNekoboxConfig(links, true);
        const singboxConfig = generateSingboxConfig(links, true);

        // Send files
        await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
        await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
        await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');

      } catch (error) {
        console.error('Error processing links:', error);
        await this.sendMessage(chatId, `Error: ${error.message}`);
      }
    } 
    else {
      await this.sendMessage(chatId, 'Please send VMess, VLESS, Trojan, or Shadowsocks links for conversion.');
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async editMessageReplyMarkup({ chat_id, message_id, reply_markup }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = {
      chat_id,
      message_id,
      reply_markup,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = {
      callback_query_id: callbackQueryId,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`, {
        method: 'POST',
        body: formData,
      }
    );

    return response.json();
  }
}
