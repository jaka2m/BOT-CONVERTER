import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './converter/configGenerators.js';
import { checkProxyIP, randomconfig } from './checkip.js';
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
    const message = update.message;
    const callback = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';

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

      // /converter command
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

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
      const ipLines = lines.filter(l => ipPortRegex.test(l));
      const proxyUrls = lines.filter(l => proxyUrlRegex.test(l));

      // Cek IP
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

      // Buat file konfigurasi
      if (proxyUrls.length > 0) {
        try {
          const clash = generateClashConfig(proxyUrls, true);
          const neko = generateNekoboxConfig(proxyUrls, true);
          const singbox = generateSingboxConfig(proxyUrls, true);

          await this.sendDocument(chatId, clash, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, neko, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singbox, 'singbox.bpf', 'application/json');
        } catch (err) {
          console.error('Error generating config:', err);
          await this.sendMessage(chatId, `Terjadi kesalahan saat generate konfigurasi: ${err.message}`);
        }
      }

      // Handler command tambahan
      await handleCommand({ text, chatId, userId, sendMessage: this.sendMessage.bind(this) });
    }

    // Callback handler
    if (callback) {
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

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const payload = { chat_id: chatId, text, ...options };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
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
