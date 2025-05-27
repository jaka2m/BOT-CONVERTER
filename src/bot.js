import {
  
  createProtocolInlineKeyboard,
  createInitialWildcardInlineKeyboard,
  createWildcardOptionsInlineKeyboard,
  generateConfig,
  handleIpMessage
} from './cekvpn.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update, send, edit) {
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

      // Contoh penggunaan handleIpMessage dari cekvpn.js
      await handleIpMessage({
        chatId,
        text,
        send: async (msg, options) => await send(chatId, msg, options),
        edit: async (msg, messageId, options) => await edit(chatId, msg, messageId, options),
        API_URL: 'https://api.example.com/ip/', // Ganti dengan API-mu
        DEFAULT_HOST: 'default.host.com' // Ganti dengan host defaultmu
      });
    }

    if (update.callback_query) {
      // Tangani callback query di sini, misal parsing callback_data
      const data = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;

      // Contoh parsing callback_data sederhana
      const parts = data.split('|');

      if (parts[0] === 'PROTOCOL') {
        const [, protocol, ip, port] = parts;
        // Kirim opsi wildcard setelah pilih protocol
        await send(chatId, `Pilih wildcard untuk ${protocol}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol)
        });
      } else if (parts[0] === 'SHOW_WILDCARD') {
        const [, protocol, ip, port] = parts;
        await send(chatId, `Pilih wildcard options untuk ${protocol}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol)
        });
      } else if (parts[0] === 'WILDCARD') {
        const [, protocol, ip, port, wildcardKey] = parts;
        // Contoh generate config dan kirim balik
        // Untuk ini, harus ambil data IP dari tempData atau API lagi, contoh pake dummy
        const config = { ip, port, isp: 'ISP Example', latitude: '0', longitude: '0' };
        const configText = generateConfig(config, protocol, 'default.host.com', wildcardKey);
        await send(chatId, configText);
      } else if (parts[0] === 'NOWILDCARD') {
        const [, protocol, ip, port] = parts;
        const config = { ip, port, isp: 'ISP Example', latitude: '0', longitude: '0' };
        const configText = generateConfig(config, protocol, 'default.host.com', null);
        await send(chatId, configText);
      } else if (parts[0] === 'BACK') {
        const [, ip, port] = parts;
        await send(chatId, "Pilih protocol:", {
          reply_markup: createProtocolInlineKeyboard(ip, port)
        });
      }

      // Bisa kirim callback_query answer juga kalau perlu
    }
  }
}
