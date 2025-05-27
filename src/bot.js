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

    // Pesan sambutan saat user mengirim /start
    if (text.startsWith('/start')) {
      const startMessage =
        'Selamat datang di *Stupid World Converter Bot*!\n\n' +
        'Gunakan perintah /converter untuk memulai mengubah link proxy Anda ke format:\n' +
        '- Singbox\n- Nekobox\n- Clash\n\n' +
        'Bot ini mendukung format VMess, VLESS, Trojan, dan Shadowsocks.\n\n' +
        'Ketik /converter untuk info lebih lanjut.';
      await this.sendMessage(chatId, startMessage);
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/converter')) {
      const welcomeMessage = 
        '🤖 Stupid World Converter Bot\n\n' +
        'Kirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox, dan Clash.\n\n' +
        'Contoh:\n' +
        'vless://...\n' +
        'vmess://...\n' +
        'trojan://...\n' +
        'ss://...\n\n' +
        'Catatan:\n' +
        '- Maksimal 10 link per permintaan.\n' +
        '- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\n' +
        'Baca baik-baik dulu sebelum nanya.';
      await this.sendMessage(chatId, welcomeMessage);

    } else if (text.includes('://')) {
      try {
        const links = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('://'))
          .slice(0, 10);  // batasi max 10

        if (links.length === 0) {
          await this.sendMessage(chatId, 'Tidak ditemukan link valid. Kirimkan link VMess, VLESS, Trojan, atau Shadowsocks.');
          return new Response('OK', { status: 200 });
        }

        const checkResults = await Promise.all(links.map(link => checkProxyIP(link)));

        let statusReport = 'Status Proxy:\n';
        for (const r of checkResults) {
          statusReport += `- ${r.ip} (${r.country}): ${r.status}, Delay: ${r.delay}, ISP: ${r.isp}\n`;
        }
        await this.sendMessage(chatId, statusReport);

        const clashConfig = generateClashConfig(links, true);
        const nekoboxConfig = generateNekoboxConfig(links, true);
        const singboxConfig = generateSingboxConfig(links, true);

        await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
        await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
        await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');

      } catch (error) {
        console.error('Error processing links:', error);
        await this.sendMessage(chatId, `Terjadi kesalahan: ${error.message}`);
      }

    } else {
      await this.sendMessage(chatId, 'Silakan kirim link VMess, VLESS, Trojan, atau Shadowsocks untuk dikonversi.');
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
