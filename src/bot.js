import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';
import { checkProxyIP, randomconfig } from './checkip.js';
import { rotateconfig } from './config.js';
import { handleCommand } from './commandHandler.js';
import { handleCallback, answerCallback, editMessageReplyMarkup } from './callbackHandler.js';
import { randomip } from './randomip.js';

const HOSTKU = 'example.com';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(request) {
    const body = await request.json();
    const message = body.message;
    const callback = body.callback_query;

    const chatId = message?.chat?.id || callback?.message?.chat?.id;
    const userId = message?.from?.id || callback?.from?.id;
    const text = message?.text || '';

    if (text) {
      // Command handling (gabungan dari kode kamu yang sebelumnya)
      // Contoh /start
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

      // /config
      if (text.startsWith('/config')) {
        await this.sendMessage(
          chatId,
          `🌟 *PANDUAN CONFIG ROTATE* 🌟

Ketik perintah berikut untuk mendapatkan config rotate berdasarkan negara:

\`/rotate + kode_negara\`

Negara tersedia:
id, sg, my, us, ca, in, gb, ir, ae, fi, tr, md, tw, ch, se, nl, es, ru, ro, pl, al, nz, mx, it, de, fr, am, cy, dk, br, kr, vn, th, hk, cn, jp.

Contoh:
\`/rotate id\`
\`/rotate sg\`
\`/rotate my\`

Bot akan memilih IP secara acak dari negara tersebut dan mengirimkan config-nya.`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      // /rotate
      if (text.startsWith('/rotate ')) {
        await rotateconfig.call(this, chatId, text);
        return new Response('OK', { status: 200 });
      }

      // /randomconfig
      if (text.startsWith('/randomconfig')) {
        const loadingMsg = await this.sendMessageWithDelete(chatId, '⏳ Membuat konfigurasi acak...');
        try {
          const configText = await randomconfig();
          await this.sendMessage(chatId, configText, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('Error generating random config:', error);
          await this.sendMessage(chatId, `⚠️ Terjadi kesalahan saat generate konfigurasi acak:\n${error.message}`);
        }
        if (loadingMsg && loadingMsg.message_id) {
          await this.deleteMessage(chatId, loadingMsg.message_id);
        }
        return new Response('OK', { status: 200 });
      }

      // /listwildcard
      if (text.startsWith('/listwildcard')) {
        try {
          const wildcards = [
            "ava.game.naver.com",
            "joss.checker-ip.xyz",
            "business.blibli.com",
            "ava.game.naver.com",
            "graph.instagram.com",
            "quiz.int.vidio.com",
            "live.iflix.com",
            "support.zoom.us",
            "blog.webex.com",
            "investors.spotify.com",
            "cache.netflix.com",
            "zaintest.vuclip.com",
            "io.ruangguru.com",
            "api.midtrans.com",
            "investor.fb.com",
            "bakrie.ac.id"
          ];

          const total = wildcards.length;

          let configText = `*🏷️ LIST WILDCARD 🏷️*\n══════════════════\n\n`;

          wildcards.forEach((domain, index) => {
            configText += `*${index + 1}.* \`${domain}.${HOSTKU}\`\n`;
          });

          configText += `\n📦 *Total:* ${total} wildcard\n`;
          configText += `\n👨‍💻 *Modded By:* [Geo Project](https://t.me/sampiiiiu)`;

          await this.sendMessage(chatId, configText, { parse_mode: "Markdown" });
        } catch (error) {
          console.error('Error in /listwildcard:', error);
          await this.sendMessage(chatId, `⚠️ Terjadi kesalahan:\n${error.message}`);
        }
        return new Response('OK', { status: 200 });
      }

      // /converter
      if (text.startsWith('/converter')) {
        const infoMessage =
          '🧠 *Stupid World Converter Bot*\n\n' +
          'Kirimkan saya link konfigurasi V2Ray ATAU IP:PORT dan saya akan mengubahnya ke format:\n' +
          '- Singbox\n- Nekobox\n- Clash\n\n' +
          '*Contoh:*\n' +
          '`vless://...`\n' +
          '`104.21.75.43:443`\n\n' +
          '*Catatan:*\n- Maksimal 10 link atau IP per permintaan.';
        await this.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      // Regex validasi IP:PORT dan proxy URL
      const ipPortRegex = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
      const proxyUrlRegex = /^(vless|vmess|trojan|ss):\/\/.+$/i;

      // Parsing dan filter input (maks 10 baris)
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 10);
      const ipLines = lines.filter(line => ipPortRegex.test(line));
      const proxyUrls = lines.filter(line => proxyUrlRegex.test(line));

      // Jika ada IP:PORT, cek info IP
      if (ipLines.length > 0) {
        const loadingMsg = await this.sendMessageWithDelete(chatId, '⏳ Cek IP sedang berlangsung...');

        try {
          const results = await Promise.all(ipLines.map(ip => checkProxyIP(ip)));

          let report = '```INFORMATION\n';
          for (const r of results) {
            report +=
              `IP       : ${r.ip}:${r.port}\n` +
              `Status   : ${r.status}\n` +
              `Delay    : ${r.delay}\n` +
              `Country  : ${r.country}\n` +
              `City     : ${r.city}\n` +
              `ISP      : ${r.isp}\n` +
              `Region   : ${r.regionName}\n` +
              `ASN      : ${r.asn}\n` +
              `Timezone : ${r.timezone}\n` +
              `Org      : ${r.org}\n\n`;
          }
          report += '```';

          await this.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('IP Check Error:', error);
          await this.sendMessage(chatId, `Terjadi kesalahan saat cek IP: ${error.message}`);
        }

        if (loadingMsg && loadingMsg.message_id) {
          await this.deleteMessage(chatId, loadingMsg.message_id);
        }
      }

      // Jika ada proxy URLs, generate konfigurasi
      if (proxyUrls.length > 0) {
        try {
          const clashConfig = generateClashConfig(proxyUrls, true);
          const nekoboxConfig = generateNekoboxConfig(proxyUrls, true);
          const singboxConfig = generateSingboxConfig(proxyUrls, true);

          await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');
        } catch (error) {
          console.error('Error generating config:', error);
          await this.sendMessage(chatId, `Terjadi kesalahan saat generate konfigurasi: ${error.message}`);
        }
      }

    } else if (callback) {
      // Callback query handling
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

  // Helper: send message
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Helper: send message with auto delete
  async sendMessageWithDelete(chatId, text, timeoutMs = 8000) {
    const msg = await this.sendMessage(chatId, text);
    if (msg.ok && msg.result && msg.result.message_id) {
      setTimeout(() => {
        this.deleteMessage(chatId, msg.result.message_id).catch(console.error);
      }, timeoutMs);
    }
    return msg.result;
  }

  // Helper: delete message
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Helper: send document/file
  async sendDocument(chatId, content, filename, mimeType) {
    // Telegram API expects multipart/form-data for sending files,
    // but if content is string, we can send as InputFile by base64 or via Buffer.
    // Here, assume we use fetch + FormData (in node or environment with FormData)

    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);

    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
  }
}
