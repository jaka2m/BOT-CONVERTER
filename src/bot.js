import { checkProxyIP } from './checkip.js';

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

if (text === '/start') {
  await this.sendMessage(
    chatId,
    'Selamat datang!\n\nKirim IP atau IP:PORT untuk memeriksa status proxy dan memilih konfigurasi (VLESS, Trojan, VMess, Shadowsocks).'
  );
  return new Response('OK', { status: 200 });
}

// Hanya lanjutkan jika input adalah IP atau IP:PORT
const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
if (!ipPortPattern.test(text)) {
  // Abaikan tanpa membalas jika format salah
  return new Response('OK', { status: 200 });
}

// Tampilkan pesan "loading"
const loadingMsg = await this.sendMessage(chatId, '⏳ Sedang memeriksa proxy...');

// Edit pesan dengan tombol konfigurasi
await this.editMessage(
  chatId,
  loadingMsg.result.message_id,
  `Pilih konfigurasi untuk \`${text}\`:`,
  this.getMainKeyboard(text)
);

return new Response('OK', { status: 200 });


// ======= GENERATE DAN KIRIM KONFIGURASI =======
const clashConfig = generateClashConfig(links, true);
const nekoboxConfig = generateNekoboxConfig(links, true);
const singboxConfig = generateSingboxConfig(links, true);

try {
  // Kirim file konfigurasi
  await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
  await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
  await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');

} catch (error) {
  console.error('Error processing links:', error);
  await this.sendMessage(chatId, `Error: ${error.message}`);
}

} else {
  await this.sendMessage(chatId, 'Please send VMess, VLESS, Trojan, or Shadowsocks links for conversion.');
}

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
