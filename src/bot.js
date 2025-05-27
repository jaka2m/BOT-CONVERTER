import {
  generateClashConfig,
  generateNekoboxConfig,
  generateSingboxConfig
} from './configGenerators.js';

import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // /start
    if (text.startsWith('/start')) {
      const startMessage =
        'Selamat datang di Stupid World Converter Bot!\n\n' +
        'Gunakan perintah /converter untuk mulai mengubah link proxy Anda ke format:\n' +
        '- Singbox\n- Nekobox\n- Clash\n\n' +
        'Ketik /converter untuk info lebih lanjut.';
      await this.sendMessage(chatId, startMessage);
      return new Response('OK', { status: 200 });
    }

    // /converter
    if (text.startsWith('/converter')) {
      const welcomeMessage =
        'ðŸ¤– Stupid World Converter Bot\n\n' +
        'Kirimkan saya link konfigurasi V2Ray ATAU IP:PORT dan saya akan mengubahnya ke format Singbox, Nekobox, dan Clash.\n\n' +
        'Contoh:\n' +
        'vless://...\n' +
        'Catatan:\n' +
        '- Maksimal 10 link atau IP per permintaan.';
      await this.sendMessage(chatId, welcomeMessage);
      return new Response('OK', { status: 200 });
    }

    // Regex validasi IP atau IP:PORT
    const ipPortRegex = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
    // Regex validasi URL proxy (vless, vmess, trojan, ss)
    const proxyUrlRegex = /^(vless|vmess|trojan|ss):\/\/.+$/i;

    // Ambil maksimal 10 baris teks yang tidak kosong
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).slice(0, 10);

    // Pisahkan antara IP/IP:PORT dan URL proxy
    const ipLines = lines.filter(line => ipPortRegex.test(line));
    const proxyUrls = lines.filter(line => proxyUrlRegex.test(line));

    // Jika ada IP/IP:PORT, lakukan cek IP
    if (ipLines.length > 0) {
      try {
        const checkResults = await Promise.all(ipLines.map(ip => checkProxyIP(ip)));

        let statusReport = '\`\`\`INFORMATION\n';
        for (const r of checkResults) {
          statusReport +=
            `IP       : ${r.ip}:${r.port}\n` +
            `Status   : ${r.status}\n` +
            `Delay    : ${r.delay}\n` +
            `Country  : ${r.country}\n` +
            `City     : ${r.city}\n` +
            `ISP      : ${r.isp}\n` +
            `Region   : ${r.regionName}\n` +
            `ASN      : ${r.asn}\n` +
            `Timezone : ${r.timezone}\n` +
            `Org      : ${r.org}
            \`\`\``;
        }
        await this.sendMessage(chatId, statusReport);
      } catch (error) {
        console.error('Error checking IP:', error);
        await this.sendMessage(chatId, `Terjadi kesalahan saat cek IP: ${error.message}`);
      }
    }

    // Jika ada proxy URL, generate config
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

    // Jika input bukan IP/IP:PORT atau URL proxy, abaikan tanpa balasan
    if (ipLines.length === 0 && proxyUrls.length === 0) {
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }
}
