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
    const userId = update.message.from.id;
    const text = update.message.text?.trim() || '';

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

    // Tambahkan ini supaya handleCommand berjalan di dalam blok yang valid (misalnya di else)
    await handleCommand({ text, chatId, userId, sendMessage: this.sendMessage.bind(this) });

    // Jika input tidak dikenali
    await this.sendMessage(chatId, 'Mohon kirim IP, IP:PORT, atau link konfigurasi V2Ray (VMess, VLESS, Trojan, SS).');
    return new Response('OK', { status: 200 });
  }

  // Kamu harus juga buat definisi fungsi seperti sendMessage, sendDocument, editMessage, answerCallback, getMainKeyboard, getConfigKeyboard, getTLSConfig, getNonTLSConfig di class ini atau import dari modul lain sesuai kebutuhan



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

// Di luar fungsi di atas (bukan di dalam answerCallback!)
if (callback) {
  await handleCallback({
    callback,
    sendMessage: this.sendMessage.bind(this),
    answerCallback: this.answerCallback.bind(this),
    editMessageReplyMarkup: this.editMessageReplyMarkup.bind(this),
    token: this.token,
    apiUrl: this.apiUrl
  });
}
