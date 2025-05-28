import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { checkProxyIP } from './checkip.js';
import { randomconfig } from './randomconfig.js';
import { rotateconfig } from './config.js';
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
    // Abaikan jika bukan message atau callback_query
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    // Tangani callback_query (tombol)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      const [action, ipPort] = data.split('|');

      if (action === 'back') {
        await this.editMessage(
          chatId,
          messageId,
          'Kirim pesan dengan format IP atau IP:PORT untuk cek status proxy dan pilih konfigurasi.',
          this.getMainKeyboard(ipPort)
        );
        await this.answerCallback(callback.id);
        return new Response('OK', { status: 200 });
      }

      const result = await checkProxyIP(ipPort);
      if (result.status !== 'ACTIVE') {
        await this.answerCallback(callback.id, 'Proxy tidak aktif atau format salah');
        return new Response('OK', { status: 200 });
      }

      await this.editMessage(
        chatId,
        messageId,
        `Konfigurasi untuk \`${ipPort}\`:\n\n` +
          '```TLS\n' +
          `${this.getTLSConfig(result, action)}\n` +
          '```' +
          '```Non-TLS\n' +
          `${this.getNonTLSConfig(result, action)}\n` +
          '```',
        this.getConfigKeyboard(ipPort)
      );

      await this.answerCallback(callback.id);
      return new Response('OK', { status: 200 });
    }

    // Tangani pesan teks biasa
    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    // /start command
      if (text.startsWith('/start')) {
        const startMessage =
          'Selamat datang di *Stupid World Converter Bot!*\n\n' +
          'Gunakan perintah:\n' +
          '• `/converter` — untuk mengubah link proxy ke format:\n' +
          '  - Singbox\n  - Nekobox\n  - Clash\n\n' +
          '• `/randomip` — untuk mendapatkan 20 IP acak dari daftar proxy\n\n' +
          'Ketik `/converter` untuk info lebih lanjut.';
        await this.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

// /config command
      if (text.startsWith('/config')) {
        const helpMsg = `🌟 *PANDUAN CONFIG ROTATE* 🌟

Ketik perintah berikut untuk mendapatkan config rotate berdasarkan negara:

\`/rotate + kode_negara\`

Negara tersedia:
id, sg, my, us, ca, in, gb, ir, ae, fi, tr, md, tw, ch, se, nl, es, ru, ro, pl, al, nz, mx, it, de, fr, am, cy, dk, br, kr, vn, th, hk, cn, jp.

Contoh:
\`/rotate id\`
\`/rotate sg\`
\`/rotate my\`

Bot akan memilih IP secara acak dari negara tersebut dan mengirimkan config-nya.`;
        await this.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      // /rotate command
      if (text.startsWith('/rotate ')) {
        await rotateconfig.call(this, chatId, text);
        return new Response('OK', { status: 200 });
      }

      // /randomconfig command
      if (text.startsWith('/randomconfig')) {
        const loadingMsg = await this.sendMessageWithDelete(chatId, '⏳ Membuat konfigurasi acak...');
        try {
          const configText = await randomconfig();
          await this.sendMessage(chatId, configText, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('Error generating random config:', error);
          await this.sendMessage(chatId, `⚠️ Terjadi kesalahan:\n${error.message}`);
        }
        if (loadingMsg && loadingMsg.message_id) {
          await this.deleteMessage(chatId, loadingMsg.message_id);
        }
        return new Response('OK', { status: 200 });
      }

      // /listwildcard command
      if (text.startsWith('/listwildcard')) {
        const wildcards = [
          "ava.game.naver.com", "joss.checker-ip.xyz", "business.blibli.com", "graph.instagram.com",
          "quiz.int.vidio.com", "live.iflix.com", "support.zoom.us", "blog.webex.com",
          "investors.spotify.com", "cache.netflix.com", "zaintest.vuclip.com", "io.ruangguru.com",
          "api.midtrans.com", "investor.fb.com", "bakrie.ac.id"
        ];

        const configText =
          `*🏷️ LIST WILDCARD 🏷️*\n══════════════════\n\n` +
          wildcards.map((d, i) => `*${i + 1}.* \`${d}.${HOSTKU}\``).join('\n') +
          `\n\n📦 *Total:* ${wildcards.length} wildcard` +
          `\n\n👨‍💻 *Modded By:* [Geo Project](https://t.me/sampiiiiu)`;

        await this.sendMessage(chatId, configText, { parse_mode: "Markdown" });
        return new Response('OK', { status: 200 });
      }

    // Pola IP atau IP:PORT
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    // Kalau pesan bukan IP atau IP:PORT, jangan balas
    if (!ipPortPattern.test(text)) {
      return new Response('OK', { status: 200 });
    }

    // Kirim pesan loading
    const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

    // Edit pesan loading menjadi menu pilihan konfigurasi
    await this.editMessage(
      chatId,
      loadingMsg.result.message_id,
      `Pilih konfigurasi untuk \`${text}\`:`,
      this.getMainKeyboard(text)
    );

    return new Response('OK', { status: 200 });
  }

  getTLSConfig(result, action) {
    switch (action) {
      case 'vless':
        return result.vlessTLSLink || '';
      case 'trojan':
        return result.trojanTLSLink || '';
      case 'vmess':
        return result.vmessTLSLink || '';
      case 'ss':
        return result.ssTLSLink || '';
      default:
        return '';
    }
  }

  getNonTLSConfig(result, action) {
    switch (action) {
      case 'vless':
        return result.vlessNTLSLink || '';
      case 'trojan':
        return result.trojanNTLSLink || '';
      case 'vmess':
        return result.vmessNTLSLink || '';
      case 'ss':
        return result.ssNTLSLink || '';
      default:
        return '';
    }
  }

  getMainKeyboard(ipPort) {
    return {
      inline_keyboard: [
        [
          { text: 'VLESS', callback_data: `vless|${ipPort}` },
          { text: 'TROJAN', callback_data: `trojan|${ipPort}` },
        ],
        [
          { text: 'VMESS', callback_data: `vmess|${ipPort}` },
          { text: 'SHADOWSOCKS', callback_data: `ss|${ipPort}` },
        ],
        [{ text: 'BACK', callback_data: `back|${ipPort}` }],
      ],
    };
  }

  getConfigKeyboard(ipPort) {
    return {
      inline_keyboard: [[{ text: 'Kembali ke menu', callback_data: `back|${ipPort}` }]],
    };
  }

  async sendMessage(chatId, text, replyMarkup) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

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
    if (replyMarkup) body.reply_markup = replyMarkup;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

async sendMessageWithDelete(chatId, text) {
    try {
      const res = await this.sendMessage(chatId, text);
      return res.result;
    } catch (e) {
      console.error('Gagal mengirim pesan loading:', e);
      return null;
    }
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
    return res.json();
  }


  async answerCallback(callbackQueryId, text = '') {
  const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
  const body = {
    callback_query_id: callbackQueryId,
    text,
    show_alert: !!text,
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
  formData.append('chat_id', chatId);
  formData.append('document', new Blob([content], { type: mimeType }), filename);

  const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  });

  return res.json();
}
}
