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

    // ======= HANDLE CALLBACK (TOMBOL) =======
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
        '```INFORMATION\n' +
        `IP       :${result.ip}\n` +
        `PORT     :${result.port}\n` +
        `ISP      :${result.isp}\n` +
        `COUNTRY  :${result.country}\n` +
        `DELAY    :${result.delay}\n` +
        `STATUS   :✅ ${result.status}\n` +
        '```' +
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

    // ======= HANDLE PESAN MASUK =======
    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';
    async handleUpdate(update) {
  const message = update.message;
  const callback = update.callback_query;

  if (message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text?.trim() || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 'Halo! Selamat datang di bot kami. Ketik /help untuk bantuan.');
    } else if (text.startsWith('/listwildcard')) {
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
    } else {
      await handleCommand({ text, chatId, userId, sendMessage: this.sendMessage.bind(this) });
    }
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

  // Jika pesan mengandung protokol proxy (vless://, vmess://, trojan://, ss://)
  if (text.includes('://')) {
    try {
      // Ambil baris yang mengandung link valid
      const links = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('://'))
        .slice(0, 10); // Batasi maksimal 10 link

      if (links.length === 0) {
        await this.sendMessage(chatId, 'Tidak ada link valid yang ditemukan. Kirimkan link VMess, VLESS, Trojan, atau Shadowsocks.');
        return new Response('OK', { status: 200 });
      }

      // Generate konfigurasi
      const clashConfig = generateClashConfig(links, true);
      const nekoboxConfig = generateNekoboxConfig(links, true);
      const singboxConfig = generateSingboxConfig(links, true);

      // Kirim file konfigurasi
      await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
      await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
      await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');
    } catch (error) {
      console.error('Error processing links:', error);
      await this.sendMessage(chatId, `Error: ${error.message}`);
    }
    return new Response('OK', { status: 200 });
  }

  // Jika input adalah IP atau IP:PORT
  const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
  if (ipPortPattern.test(text)) {
    const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');
    await this.editMessage(
      chatId,
      loadingMsg.result.message_id,
      `Pilih konfigurasi untuk \`${text}\`:`,
      this.getMainKeyboard(text)
    );
    return new Response('OK', { status: 200 });
  }

  // Jika input tidak dikenali
  await this.sendMessage(chatId, 'Mohon kirim IP, IP:PORT, atau link konfigurasi V2Ray (VMess, VLESS, Trojan, SS).');
  return new Response('OK', { status: 200 });
}


  getTLSConfig(result, action) {
    switch (action) {
      case 'vless': return result.vlessTLSLink || '';
      case 'trojan': return result.trojanTLSLink || '';
      case 'vmess': return result.vmessTLSLink || '';
      case 'ss': return result.ssTLSLink || '';
      default: return '';
    }
  }

  getNonTLSConfig(result, action) {
    switch (action) {
      case 'vless': return result.vlessNTLSLink || '';
      case 'trojan': return result.trojanNTLSLink || '';
      case 'vmess': return result.vmessNTLSLink || '';
      case 'ss': return result.ssNTLSLink || '';
      default: return '';
    }
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

  getConfigKeyboard(ipPort) {
    return {
      inline_keyboard: [
        [
          { text: 'Kembali ke menu', callback_data: `back|${ipPort}` }
        ]
      ]
    };
  }

  // Mengirim pesan ke chat
async sendMessage(chatId, text, replyMarkup) {
  const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
  const body = {
    chat_id: chatId,
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

// Mengedit pesan yang sudah dikirim
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

// Mengirim file (dokumen) ke chat
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

// Mengirim pesan lalu menyimpan message_id
async sendMessageWithDelete(chatId, text) {
  try {
    const res = await this.sendMessage(chatId, text);
    return res.result;
  } catch (e) {
    console.error('Gagal mengirim pesan:', e);
    return null;
  }
}

// Menghapus pesan dari chat
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

// Menjawab callback query (dari inline keyboard)
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
} 
