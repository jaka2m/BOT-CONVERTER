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

  async sendRequest(method, body) {
    const url = `${this.apiUrl}/bot${this.token}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.sendRequest('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...extra
    });
  }

  async editMessage(chatId, messageId, text, extra = {}) {
    return this.sendRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...extra
    });
  }

  async deleteMessage(chatId, messageId) {
    return this.sendRequest('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async sendChatAction(chatId, action = 'typing') {
    return this.sendRequest('sendChatAction', {
      chat_id: chatId,
      action
    });
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });

    // Handle text input: IP or IP:PORT
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const messageId = update.message.message_id;
      const text = update.message.text.trim();

      const ipOnlyMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/);
      const ipPortMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);

      if (!ipOnlyMatch && !ipPortMatch) return new Response('OK', { status: 200 });

      const ip = ipPortMatch ? ipPortMatch[1] : ipOnlyMatch[1];
      const port = ipPortMatch ? ipPortMatch[2] : '443';

      await this.deleteMessage(chatId, messageId);
      await this.sendChatAction(chatId, 'typing');
      const loadingMsg = await this.sendMessage(chatId, '⏳');

      const data = await fetchIPData(ip, port);
      if (!data) {
        await this.editMessage(chatId, loadingMsg.result.message_id, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
        return new Response('OK', { status: 200 });
      }

      const { isp, country, delay, status } = data;
      const infoText = `\`\`\`INFORMATION
IP     : ${ip}
PORT   : ${port}
ISP    : ${isp}
Country: ${country || '-'}
Delay  : ${delay || '-'}
Status : ${status || '-'}
\`\`\`
Pilih protokol:`;

      await this.editMessage(chatId, loadingMsg.result.message_id, infoText, {
        reply_markup: createProtocolInlineKeyboard(ip, port)
      });

      return new Response('OK', { status: 200 });
    }

    // Handle callback queries (button actions)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;
      const parts = data.split('|');

      const [action, ...args] = parts;

      if (action === "PROTOCOL") {
        const [protocol, ip, port] = args;
        await this.editMessage(chatId, messageId, `⚙️ Opsi wildcard untuk ${protocol}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol)
        });
      }

      else if (action === "SHOW_WILDCARD") {
        const [protocol, ip, port] = args;
        await this.editMessage(chatId, messageId, `⚙️ Opsi wildcard untuk ${protocol}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
        });
      }

      else if (action === "NOWILDCARD") {
        const [protocol, ip, port] = args;

        await this.sendChatAction(chatId, 'typing');
        const loadingMsg = await this.sendMessage(chatId, '⏳');
        const dataInfo = await fetchIPData(ip, port);

        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response('OK', { status: 200 });
        }

        const configText = generateConfig(dataInfo, protocol, null);
        await this.editMessage(chatId, messageId, `✅ Config ${protocol} NO Wildcard:\n${configText}\n`, {
          parse_mode: 'Markdown'
        });

        await this.deleteMessage(chatId, loadingMsg.result.message_id);
        await this.sendMessage(chatId, `⬅️ Kembali`, {
          reply_markup: {
            inline_keyboard: [[{
              text: '⬅️ Back',
              callback_data: `BACK_WILDCARD|${protocol}|${ip}|${port}`
            }]]
          }
        });
      }

      else if (action === "WILDCARD") {
        const [protocol, ip, port, wildcardKey] = args;

        await this.sendChatAction(chatId, 'typing');
        const loadingMsg = await this.sendMessage(chatId, '⏳');
        const dataInfo = await fetchIPData(ip, port);

        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response('OK', { status: 200 });
        }

        const configText = generateConfig(dataInfo, protocol, wildcardKey);
        await this.editMessage(chatId, messageId, `✅ Config ${protocol} Wildcard *${wildcardKey}*:\n${configText}\n`, {
          parse_mode: 'Markdown'
        });

        await this.deleteMessage(chatId, loadingMsg.result.message_id);
        await this.sendMessage(chatId, `⬅️ Kembali`, {
          reply_markup: {
            inline_keyboard: [[{
              text: '⬅️ Back',
              callback_data: `BACK_WILDCARD|${protocol}|${ip}|${port}`
            }]]
          }
        });
      }

      else if (action === "BACK_WILDCARD") {
        const [protocol, ip, port] = args;
        await this.editMessage(chatId, messageId, `⚙️ Opsi wildcard untuk ${protocol}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
        });
      }

      else if (action === "BACK") {
        const [ip, port] = args;
        const dataInfo = await fetchIPData(ip, port);

        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`);
          return new Response('OK', { status: 200 });
        }

        const infoText = `Data untuk IP ${ip}:${port}:\nISP: ${dataInfo.isp}\nCountry: ${dataInfo.country}\n\nPilih protokol:`;
        await this.editMessage(chatId, messageId, infoText, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });
      }

      return new Response('OK', { status: 200 });
    }
  }
}
