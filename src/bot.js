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
        'Selamat datang di *Stupid World Converter Bot*!\n\n' +
        'Gunakan perintah /converter untuk mulai mengubah link proxy Anda ke format:\n' +
        '- Singbox\n- Nekobox\n- Clash\n\n' +
        'Ketik /converter untuk info lebih lanjut.';
      await this.sendMessage(chatId, startMessage);
      return new Response('OK', { status: 200 });
    }

    // /converter
    if (text.startsWith('/converter')) {
      const welcomeMessage =
        '🤖 Stupid World Converter Bot\n\n' +
        'Kirimkan saya link konfigurasi V2Ray ATAU IP:PORT dan saya akan mengubahnya ke format Singbox, Nekobox, dan Clash.\n\n' +
        'Contoh:\n' +
        'vless://...\n' +
        '103.102.231.115:2053\n\n' +
        'Catatan:\n' +
        '- Maksimal 10 link atau IP per permintaan.';
      await this.sendMessage(chatId, welcomeMessage);
      return new Response('OK', { status: 200 });
    }

    // Deteksi apakah teks berisi URI atau IP:PORT
    const isProxyFormat = text.includes('://') || /^\d{1,3}(\.\d{1,3}){3}:\d+/.test(text);

    if (isProxyFormat) {
      try {
        // Ambil hingga 10 baris proxy yang valid
        const links = text
          .split('\n')
          .map(line => line.trim())
          .filter(line =>
            line.includes('://') || /^\d{1,3}(\.\d{1,3}){3}:\d+/.test(line)
          )
          .slice(0, 10);

        if (links.length === 0) {
          await this.sendMessage(chatId, 'Tidak ditemukan link/IP yang valid. Gunakan format VMess/VLESS/Trojan/SS atau IP:PORT.');
          return new Response('OK', { status: 200 });
        }

        // Cek IP satu per satu
        const checkResults = await Promise.all(links.map(link => checkProxyIP(link)));

        let statusReport = '*Status Proxy:*\n';
        for (const r of checkResults) {
          statusReport += `- ${r.ip}:${r.port} (${r.country}) — *${r.status}*, Delay: ${r.delay}\n`;
        }
        await this.sendMessage(chatId, statusReport);

        // Hanya generate config jika URI (bukan IP:PORT saja)
        const hasURI = links.some(link => link.includes('://'));
        if (hasURI) {
          const clashConfig = generateClashConfig(links, true);
          const nekoboxConfig = generateNekoboxConfig(links, true);
          const singboxConfig = generateSingboxConfig(links, true);

          await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml');
          await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json');
          await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json');
        }

      } catch (error) {
        console.error('Error processing links:', error);
        await this.sendMessage(chatId, `Terjadi kesalahan: ${error.message}`);
      }
    } else {
      await this.sendMessage(chatId, 'Silakan kirim link VMess/VLESS/Trojan/SS atau format IP:PORT untuk dicek.');
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
