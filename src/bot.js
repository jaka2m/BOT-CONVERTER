import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { randomconfig } from './randomconfig.js';
import { rotateconfig } from './config.js';
import { botku, TelegramBotku } from './randomip/bot2.js';
import { ProxyCekBot, TelegramProxyCekBot } from './proxyip/botCek.js';
import { proxyBot, TelegramProxyBot } from './proxyip/bot3.js';
import { WildcardBot, TelegramWildcardBot } from './wildcard/botwild.js';

const HOSTKU = 'joss.checker-ip.xyz';

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

      if (text.startsWith('/converter')) {
        await this.sendMessage(
          chatId,
          `🤖 *Geo Project Bot*\n\nKirimkan link konfigurasi V2Ray dan saya *SPIDERMAN* akan mengubahnya ke format *Singbox*, *Nekobox*, dan *Clash*.\n\nContoh:\n\`vless://...\`\n\`vmess://...\`\n\`trojan://...\`\n\`ss://...\`\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan *Singbox versi 1.10.3* atau *1.11.8*.`,
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
