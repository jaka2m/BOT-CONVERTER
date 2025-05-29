import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { checkProxyIP } from './checkip.js';
import { handleCommand } from './randomip/commandHandler.js';
import { handleCallback, answerCallback, editMessageReplyMarkup } from './randomip/callbackHandler.js';
import { randomip } from './randomip/randomip.js';

const HOSTKU = 'example.com';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    const message = update.message;
    const callback = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text?.trim() || '';

      // Filter pesan dulu, kalau bukan link vmess/vless/trojan/ss atau ip/ip:port atau perintah khusus, gak balas apa-apa
      const isProxyLink = /(vmess|vless|trojan|ss):\/\//i.test(text);
      const isIpPort = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/.test(text);
      const isCommand = text.startsWith('/');

      if (!isProxyLink && !isIpPort && !isCommand) {
        // Gak balas apa-apa kalau pesan gak sesuai format yang diizinkan
        return new Response('OK', { status: 200 });
      }

      // Perintah /start dan /converter
      if (text.startsWith('/start')) {
        const startMessage =
          'Selamat datang di *Stupid World Converter Bot!*\n\n' +
          'Gunakan perintah:\n' +
          '• `/converter` — untuk mengubah link proxy ke format:\n' +
          '  - Singbox\n  - Nekobox\n' +
          '  - Clash\n\n' +
          '• `/randomip` — untuk mendapatkan 20 IP acak dari daftar proxy\n\n' +
          'Ketik `/converter` untuk info lebih lanjut.';
        await this.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      if (text.startsWith('/converter')) {
        await this.sendMessage(
          chatId,
          `🤖 Stupid World Converter Bot

Kirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox dan Clash.

Contoh:
vless://...
vmess://...
trojan://...
ss://...

Catatan:
- Maksimal 10 link per permintaan.
- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.
`
        );
        return new Response('OK', { status: 200 });
      }

      // Jika pesan berupa link proxy
      if (isProxyLink) {
        try {
          const links = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => /(vmess|vless|trojan|ss):\/\//i.test(l))
            .slice(0, 10);

          if (links.length === 0) {
            // Gak balas kalau gak ada link valid
            return new Response('OK', { status: 200 });
          }

          const clashConfig = generateClashConfig(links, true);
          const nekoboxConfig = generateNekoboxConfig(links, true);
          const singboxConfig = generateSingboxConfig(links, true);

          await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');
        } catch (error) {
          console.error(error);
          await this.sendMessage(chatId, `Error: ${error.message}`);
        }
        return new Response('OK', { status: 200 });
      }

      // Jika pesan berupa IP atau IP:PORT
      if (isIpPort) {
        const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');
        await this.editMessage(
          chatId,
          loadingMsg.result.message_id,
          `Pilih konfigurasi untuk \`${text}\`:`,
          this.getMainKeyboard(text)
        );
        return new Response('OK', { status: 200 });
      }

      // Handle command lain yang kamu sudah punya di kode asli
      await handleCommand({ text, chatId, userId, sendMessage: this.sendMessage.bind(this) });

    } else if (callback) {
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

  getMainKeyboard(ipPort) {
    return {
      inline_keyboard: [
        [
          { text: 'VLESS', callback_data: `vless|${ipPort}` },
          { text: 'TROJAN', callback_data: `trojan|${ipPort}` }
        ],
        [
          { text: 'VMESS', callback_data: `vmess|${ipPort}` },
          { text: 'SHADOWSOCKS', callback_data: `ss|${ipPort}` }
        ],
        [
          { text: 'BACK', callback_data: `back|${ipPort}` }
        ]
      ]
    };
  }

  // Fungsi mengirim pesan
  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...extra,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Fungsi edit pesan
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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Fungsi mengirim file dokumen
  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([content], { type: mimeType }), filename);

    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
    await fetch(url, {
      method: 'POST',
      body: formData,
    });
  }
}
