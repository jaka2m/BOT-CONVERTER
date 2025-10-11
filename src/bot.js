import { Conver, Converterbot } from './converter/converter.js';
import { randomconfig } from './randomconfig.js';
import { rotateconfig } from './config.js';
import { botku, TelegramBotku } from './randomip/bot2.js';
import { ProxyCekBot, TelegramProxyCekBot } from './checkip/botCek.js';
import { proxyBot, TelegramProxyBot } from './proxyip/bot3.js';
import { TelegramWildcardBot } from './wildcard/botwild.js';

const HOSTKU = 'joss.gpj1.dpdns.org';

export class TelegramBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) {
      return new Response('OK', { status: 200 });
    }

    if (update.callback_query) {
      const { message, data } = update.callback_query;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      return new Response('OK', { status: 200 });
    }

    if (update.message) {
      const { chat, text: messageText } = update.message;
      const chatId = chat.id;
      const text = messageText?.trim() || '';

      if (text.startsWith('/config')) {
        const helpMsg = `🌟 *PANDUAN CONFIG ROTATE* 🌟

Ketik perintah berikut untuk mendapatkan config rotate berdasarkan negara:

\`rotate + kode_negara\`

Negara tersedia:
id, sg, my, us, ca, in, gb, ir, ae, fi, tr, md, tw, ch, se, nl, es, ru, ro, pl, al, nz, mx, it, de, fr, am, cy, dk, br, kr, vn, th, hk, cn, jp.

Contoh:
\`rotate id\`
\`rotate sg\`
\`rotate my\`

Bot akan memilih IP secara acak dari negara tersebut dan mengirimkan config-nya.`;
        await this.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      if (text.startsWith('rotate ')) {
        await rotateconfig.call(this, chatId, text);
        return new Response('OK', { status: 200 });
      }

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

      if (text.startsWith('/listwildcard')) {
        const wildcards = [
          "ava.game.naver.com", "krikkrik.tech", "business.blibli.com", "graph.instagram.com",
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
    }
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options,
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
