import {
  handleRandomIpCommand,
  handleCallbackQuery,
} from './randomip.js';

export async function botku(link) {
  console.log("Bot link:", link);
}

export class TelegramBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      await handleCallbackQuery(this, update.callback_query);
      return new Response('OK', { status: 200 });
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageId = update.message.message_id;

    if (text === '/proxy') {
      await handleRandomIpCommand(this, chatId);
      return new Response('OK', { status: 200 });
    }

    if (text === '/menu') {
      const menuText = `
══════════════════
≡      MENU UTAMA BOT      ≡
══════════════════
Pilih command sesuai kebutuhan !
══════════════════
/start → mulai bot !
/cek IP:PORT → Cek proxy ACTIVE / DEAD !
/randomcc → Config random sesuai tombol Flag CC
/traffic → Daftar pemakain akun Cloudflare ! 
/listwildcard → Daftar bug wildcard ! 
/findproxy → Cara Cari Proxy ! 
/converter → Converter Akun V2ray ! 
/random → Config random mix protocol! 
/randomip → random Proxy IPs! 
/config → Generate config auto-rotate! 
══════════════════
SUPPORT
/donate → Bantu admin 😘 !
══════════════════
`;
      await this.sendMessage(chatId, menuText);
      return new Response('OK', { status: 200 });
    }

    if (text === '/donate') {
      const imageUrl = "https://github.com/jaka1m/project/raw/main/BAYAR.jpg"; // Ganti dengan URL QRIS yang valid
      try {
        await fetch(`${this.apiUrl}/bot${this.token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imageUrl,
            caption: `
🎁 *Dukung Pengembangan Bot!* 🎁

Bantu kami terus berkembang dengan scan QRIS di atas!

Terima kasih atas dukungannya! 🙏

👨‍💻 *Modded By:* [Geo Project](https://t.me/sampiiiiu)
            `.trim(),
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 GEO PROJECT", url: "https://t.me/sampiiiiu" }]
              ]
            }
          })
        });
      } catch (error) {
        console.error(error);
      }
      return new Response('OK', { status: 200 });
    }

    if (text === '/traffic') {
      const CLOUDFLARE_API_TOKEN = "CXLOp42tNKXCCXw_8lbUJpcMRu8IXyInbtoaFkwT";
      const CLOUDFLARE_ZONE_ID = "80423e7547d2fa85e13796a1f41deced";

      const getTenDaysAgoDate = () => {
        const d = new Date();
        d.setDate(d.getDate() - 10);
        return d.toISOString().split('T')[0];
      };

      const tenDaysAgo = getTenDaysAgoDate();

      try {
        const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `query {
              viewer {
                zones(filter: { zoneTag: "${CLOUDFLARE_ZONE_ID}" }) {
                  httpRequests1dGroups(
                    limit: 10,
                    orderBy: [date_DESC],
                    filter: { date_geq: "${tenDaysAgo}" }
                  ) {
                    sum {
                      bytes
                      requests
                    }
                    dimensions {
                      date
                    }
                  }
                }
              }
            }`,
          }),
        });

        const result = await response.json();

        if (!result.data || !result.data.viewer || !result.data.viewer.zones.length) {
          throw new Error("Gagal mengambil data pemakaian.");
        }

        let usageText = "*📊 Data Pemakaian 10 Hari Terakhir:*\n\n";
        result.data.viewer.zones[0].httpRequests1dGroups.forEach((day) => {
          const tanggal = day.dimensions.date;
          const totalData = (day.sum.bytes / (1024 ** 4)).toFixed(2); // dalam TB
          const totalRequests = day.sum.requests.toLocaleString();

          usageText += `📅 *Tanggal:* ${tanggal}\n📦 *Total Data:* ${totalData} TB\n📊 *Total Requests:* ${totalRequests}\n\n`;
        });

        await this.sendMessage(chatId, usageText, { parse_mode: "Markdown" });
      } catch (error) {
        await this.sendMessage(
          chatId,
          `⚠️ Gagal mengambil data pemakaian.\n\n_Error:_ ${error.message}`,
          { parse_mode: "Markdown" }
        );
      }

      return new Response('OK', { status: 200 });
    }

    if (text === '/start') {
      const welcomeText = `
━━━━━━━━━━━━━━━━━        
≡          𝗪𝗘𝗟𝗖𝗢𝗠𝗘             ≡
━━━━━━━━━━━━━━━━━
Halo! Saya siap membantu kamu.
Gunakan /menu untuk melihat daftar perintah yang tersedia.

👨‍💻 Modded By : [Geo Project](https://t.me/sampiiiiu)

🌐 [WEB VPN TUNNEL](https://joss.checker-ip.xyz)
📺 [CHANNEL VPS & Script VPS](https://t.me/testikuy_mang)
👥 [Phreaker GROUP](https://t.me/NAMA_GROUP_MU)
━━━━━━━━━━━━━━━━━
`;
      await this.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async editMessageReplyMarkup({ chat_id, message_id, reply_markup }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = { chat_id, message_id, reply_markup };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }
}
