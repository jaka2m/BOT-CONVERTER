import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';

export async function Conver(link) {
  console.log("Bot link:", link);
}

export class Converterbot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageId = update.message.message_id;

    if (text.startsWith('/converter')) {
      await this.sendMessage(
        chatId,
        `🤖 *Geo Project Bot*\n\nKirimkan link konfigurasi V2Ray dan saya *SPIDERMAN* akan mengubahnya ke format *Singbox*, *Nekobox*, dan *Clash*.\n\nContoh:\n\`vless://...\`\n\`vmess://...\`\n\`trojan://...\`\n\`ss://...\`\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan *Singbox versi 1.10.3* atau *1.11.8*.`,
        { reply_to_message_id: messageId }
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
          await this.sendMessage(chatId, '❌ Tidak ada link valid yang ditemukan. Kirimkan link VMess, VLESS, Trojan, atau Shadowsocks.', { reply_to_message_id: messageId });
          return new Response('OK', { status: 200 });
        }

        const clashConfig = generateClashConfig(links, true);
        const nekoboxConfig = generateNekoboxConfig(links, true);
        const singboxConfig = generateSingboxConfig(links, true);

        await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml', { reply_to_message_id: messageId });
        await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json', { reply_to_message_id: messageId });
        await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json', { reply_to_message_id: messageId });

      } catch (error) {
        console.error('Error processing links:', error);
        await this.sendMessage(chatId, `Error: ${error.message}`, { reply_to_message_id: messageId });
      }
    } else {
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    if (options.reply_to_message_id) {
      formData.append('reply_to_message_id', options.reply_to_message_id.toString());
    }

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    }
    );

    return response.json();
  }
}
