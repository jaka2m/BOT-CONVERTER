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
    return this.sendRequest('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
  }

  async editMessage(chatId, messageId, text, extra = {}) {
    return this.sendRequest('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...extra });
  }

  async deleteMessage(chatId, messageId) {
    return this.sendRequest('deleteMessage', { chat_id: chatId, message_id: messageId });
  }

  async sendChatAction(chatId, action = 'typing') {
    return this.sendRequest('sendChatAction', { chat_id: chatId, action });
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });


  const chatId = update.message.chat.id;
  const messageId = update.message.message_id;
  const text = update.message.text.trim();

  // Cocokkan hanya IP atau IP:PORT
  const ipOnlyMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/);
  const ipPortMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);

  // Abaikan jika bukan IP atau IP:PORT
  if (!ipOnlyMatch && !ipPortMatch) {
    return new Response('OK', { status: 200 });
  }

  const ip = ipPortMatch ? ipPortMatch[1] : ipOnlyMatch[1];
  const port = ipPortMatch ? ipPortMatch[2] : '443'; // default port

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

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;
      const parts = data.split('|');

      if (parts[0] === "PROTOCOL") {
        const [_, protocol, ip, port] = parts;
        await this.editMessage(chatId, messageId, `⚙️ Opsi wildcard untuk ${protocol}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol)
        });
        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "SHOW_WILDCARD") {
        const [_, protocol, ip, port] = parts;
        await this.editMessage(chatId, messageId, `⚙️ Opsi wildcard untuk ${protocol}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
        });
        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "NOWILDCARD") {
        const [_, protocol, ip, port] = parts;

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
        await this.sendMessage(chatId, `🔙 Menu`, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "WILDCARD") {
        const [_, protocol, ip, port, wildcardKey] = parts;

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
        await this.sendMessage(chatId, `🔙 Menu `, {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });

        return new Response('OK', { status: 200 });
      }

      if (parts[0] === "BACK") {
        const [_, ip, port] = parts;

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
