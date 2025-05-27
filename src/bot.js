import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';
import { checkProxyIP, randomconfig } from './checkip.js';
import { rotateconfig } from './config.js';
import { randomip, getIpDetail, getFlagEmoji } from './randomip.js';

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

      // Contoh definisi HOSTKU (sesuaikan dengan konfigurasi kamu)
      const HOSTKU = 'example.com';

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

          let configText = `*🏷️ LIST WILDCARD 🏷️*\n══════════════════\n\n`;
          wildcards.forEach((domain, index) => {
            configText += `*${index + 1}.* \`${domain}.${HOSTKU}\`\n`;
          });
          configText += `\n📦 *Total:* ${wildcards.length} wildcard\n`;
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
        await this.sendMessage(chatId,
          '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nBaca baik-baik dulu sebelum nanya.'
        );
        return new Response('OK', { status: 200 });
      }

      // /randomip
      if (text.startsWith('/randomip')) {
        await this.sendMessage(chatId, '⏳ Mengambil IP proxy acak...');
        const { text: resultText, buttons } = await randomip(userId, 1);
        await this.sendMessage(chatId, resultText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
        return new Response('OK', { status: 200 });
      }

      // Handle link proxy / IP
      if (text.includes('://') || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(text)) {
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 10);
        const ipPortRegex = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
        const proxyUrlRegex = /^(vless|vmess|trojan|ss):\/\/.+$/i;

        const ipLines = lines.filter(line => ipPortRegex.test(line));
        const proxyUrls = lines.filter(line => proxyUrlRegex.test(line));

        // IP Check
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

        // Generate Config
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

        return new Response('OK', { status: 200 });
      }
    }

    // Callback handler
    else if (callback) {
      const { data, message, from, id: callbackId } = callback;

      if (data.startsWith('DETAIL_')) {
        const code = data.split('_')[1];
        const detailList = getIpDetail(from.id, code);

        if (!detailList) {
          await this.answerCallback(callbackId, 'Data tidak ditemukan.');
          return;
        }

        const detailText = `*Detail IP dari ${code} ${getFlagEmoji(code)}:*\n\n${detailList.join('\n\n')}`;
        await this.sendMessage(message.chat.id, detailText, { parse_mode: 'Markdown' });
        await this.answerCallback(callbackId);
      } else if (data.startsWith('PAGE_')) {
        const page = parseInt(data.split('_')[1]);
        // Lanjutkan dengan handler PAGE
      }
    }
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
    return response.json();
  }

  async answerCallback(callbackId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text })
    });
  }
}
