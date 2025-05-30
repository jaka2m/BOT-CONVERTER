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

  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...extra
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async editMessage(chatId, messageId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...extra
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = {
      chat_id: chatId,
      message_id: messageId
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });

    // Handle message text (IP:port)
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      const ipPortMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
      if (!ipPortMatch) {
        await this.sendMessage(chatId, "Masukkan IP dan port dengan format: `IP:PORT`\nContoh: `103.102.231.103:2053`");
        return new Response('OK', { status: 200 });
      }

      const ip = ipPortMatch[1];
      const port = ipPortMatch[2];

      const data = await fetchIPData(ip, port);
      if (!data) {
        await this.sendMessage(chatId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
        return new Response('OK', { status: 200 });
      }

      const { isp, country, latitude, longitude } = data;

      const countryFlag = country ? `` : "";
      const countryName = country ? country : "";

      const infoText = `Data untuk IP ${ip}:${port}:\nISP: ${isp}\nCountry: ${countryName} ${countryFlag}\n\nPilih protokol:`;

      await this.sendMessage(chatId, infoText, {
        reply_markup: createProtocolInlineKeyboard(ip, port)
      });

      return new Response('OK', { status: 200 });
    }

    // Handle callback query (button pressed)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      // Format data: PROTOCOL|VLESS|ip|port
      const parts = data.split('|');

      if (parts[0] === "PROTOCOL") {
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        // Tampilkan tombol wildcard / no wildcard
        await this.editMessage(chatId, messageId, `Pilih opsi wildcard untuk protokol ${protocol} pada ${ip}:${port}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "SHOW_WILDCARD") {
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        await this.editMessage(chatId, messageId, `Pilih wildcard untuk protokol ${protocol} pada ${ip}:${port}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "NOWILDCARD") {
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];

        const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memproses konfigurasi...');

        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response('OK', { status: 200 });
        }

        const configText = generateConfig(dataInfo, protocol, null);

        await this.editMessage(chatId, messageId, `✅ Config untuk ${protocol} tanpa wildcard:\n\n\`\`\`\n${configText}\n\`\`\``, {
          parse_mode: 'Markdown'
        });

        await this.deleteMessage(chatId, loadingMsg.result.message_id);

        await this.sendMessage(chatId, `⬅️ Kembali ke menu:`, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "WILDCARD") {
        const protocol = parts[1];
        const ip = parts[2];
        const port = parts[3];
        const wildcardKey = parts[4];

        const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memproses konfigurasi...');

        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response('OK', { status: 200 });
        }

        const configText = generateConfig(dataInfo, protocol, wildcardKey);

        await this.editMessage(chatId, messageId, `✅ Config untuk ${protocol} dengan wildcard *${wildcardKey}*:\n\n\`\`\`\n${configText}\n\`\`\``, {
          parse_mode: 'Markdown'
        });

        await this.deleteMessage(chatId, loadingMsg.result.message_id);

        await this.sendMessage(chatId, `⬅️ Kembali ke menu:`, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "BACK") {
        const ip = parts[1];
        const port = parts[2];

        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          return new Response('OK', { status: 200 });
        }

        const infoText = `Data untuk IP ${ip}:${port}:\nISP: ${dataInfo.isp}\nCountry: ${dataInfo.country}\n\nPilih protokol:`;

        await this.editMessage(chatId, messageId, infoText, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });

        return new Response('OK', { status: 200 });
      }

      return new Response('OK', { status: 200 });
    }
  }
}
