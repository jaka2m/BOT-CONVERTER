import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { randomconfig } from './randomconfig.js';
import { rotateconfig } from './config.js';
import { botku, TelegramBotku } from './randomip/bot2.js';
import { ProxyCekBot, TelegramProxyCekBot } from './proxyip/botCek.js';

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
      // TODO: Tambahkan logika handle callback jika diperlukan
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text?.trim() || '';

      if (text.startsWith('/converter')) {
        await this.sendMessage(
          chatId,
          `🤖 *Stupid World Converter Bot*\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format *Singbox*, *Nekobox*, dan *Clash*.\n\nContoh:\n\`vless://...\`\n\`vmess://...\`\n\`trojan://...\`\n\`ss://...\`\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan *Singbox versi 1.10.3* atau *1.11.8* untuk hasil terbaik.`,
        );
        return new Response('OK', { status: 200 });
      }

      if (text.includes('://')) {
        try {
          const links = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.includes('://'))
            .slice(0, 10);

          if (links.length === 0) {
            await this.sendMessage(chatId, '❌ Tidak ada link valid yang ditemukan. Kirimkan link VMess, VLESS, Trojan, atau Shadowsocks.');
            return new Response('OK', { status: 200 });
          }

          const clashConfig = generateClashConfig(links, true);
          const nekoboxConfig = generateNekoboxConfig(links, true);
          const singboxConfig = generateSingboxConfig(links, true);

          await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');
        } catch (error) {
          console.error('Error processing links:', error);
          await this.sendMessage(chatId, `⚠️ Error: ${error.message}`);
        }
        return new Response('OK', { status: 200 });
      }
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };

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

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });

    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async sendMessageWithDelete(chatId, text) {
    try {
      const res = await this.sendMessage(chatId, text);
      return res.result;
    } catch (e) {
      console.error('Gagal mengirim pesan:', e);
      return null;
    }
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    return res.json();
  }
}
