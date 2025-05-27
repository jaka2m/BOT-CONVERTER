import { randomip, getIpDetail, getFlagEmoji } from './randomip.js';
import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const message = update.message;
    const callback = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';

      if (text.startsWith('/start')) {
        await this.sendMessage(chatId,
          '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nBaca baik-baik dulu sebelum nanya.'
        );
      } else if (text.startsWith('/randomip')) {
        await this.sendMessage(chatId, '⏳ Mengambil IP proxy acak...');
        const { text: resultText, buttons } = await randomip(userId, 1);
        await this.sendMessage(chatId, resultText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } else if (text.includes('://')) {
        try {
          const links = text.split('\n').filter(line => line.trim().includes('://'));
          if (links.length === 0) {
            await this.sendMessage(chatId, 'No valid links found. Please send VMess, VLESS, Trojan, or Shadowsocks links.');
            return;
          }

          const clashConfig = generateClashConfig(links, true);
          const nekoboxConfig = generateNekoboxConfig(links, true);
          const singboxConfig = generateSingboxConfig(links, true);

          await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');

        } catch (error) {
          console.error('Error processing links:', error);
          await this.sendMessage(chatId, `Error: ${error.message}`);
        }
      } else {
        await this.sendMessage(chatId, 'Please send VMess, VLESS, Trojan, or Shadowsocks links for conversion.');
      }

    } else if (callback) {
      const { data, message, from, id: callbackId } = callback;

      if (data.startsWith('DETAIL_')) {
        const code = data.split('_')[1];
        const detailList = getIpDetail(from.id, code);

        if (!detailList) {
          await this.answerCallback(callbackId, 'Data tidak ditemukan.');
          return;
        }

        const detailText = `*Detail IP dari ${code} ${getFlagEmoji(code)}:*\n\n${detailList.join('\n\n')}`;
        await this.sendMessage(message.chat.id, detailText, { parse_mode: 'Markdown' });
        await this.answerCallback(callbackId);
      } else if (data.startsWith('PAGE_')) {
        const page = parseInt(data.split('_')[1], 10);
        const { text, buttons } = await randomip(from.id, page);

        // Edit pesan inline keyboard (paging)
        await this.editMessageReplyMarkup(message.chat.id, message.message_id, buttons);
        await this.answerCallback(callbackId);
      }
    }

    return new Response('OK', { status: 200 });
  }

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

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }

  async answerCallback(callbackId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: false
      })
    });
  }

  async editMessageReplyMarkup(chatId, messageId, inlineKeyboard) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: inlineKeyboard }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
