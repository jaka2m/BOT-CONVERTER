import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';
import { checkProxyIP, configrotate } from './checkip.js';

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

    // /randomconfig
    if (text.startsWith('/randomconfig')) {
      try {
        const result = await randomconfig();
        await this.sendMessage(chatId, result);
      } catch (e) {
        await this.sendMessage(chatId, `⚠️ Error: ${e.message}`);
      }
      return new Response('OK', { status: 200 });
    }

    // /converter
    if (text.startsWith('/converter')) {
      const infoMessage =
        '🤖 *Stupid World Converter Bot*\n\n' +
        'Kirimkan saya link konfigurasi V2Ray ATAU IP:PORT dan saya akan mengubahnya ke format:\n' +
        '- Singbox\n- Nekobox\n- Clash\n\n' +
        '*Contoh:*\n' +
        '`vless://...`\n\n' +
        '*Catatan:*\n- Maksimal 10 link atau IP per permintaan.';
      await this.sendMessage(chatId, infoMessage);
      return new Response('OK', { status: 200 });
    }

    // Validasi input
    const ipPortRegex = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
    const proxyUrlRegex = /^(vless|vmess|trojan|ss):\/\/.+$/i;

    const lines = text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 10);
    const ipLines = lines.filter(line => ipPortRegex.test(line));
    const proxyUrls = lines.filter(line => proxyUrlRegex.test(line));

    // Proses IP Check
    if (ipLines.length > 0) {
      const loadingMsg = await this.sendMessageWithDelete(chatId, '⏳');

      try {
        const checkResults = await Promise.all(ipLines.map(ip => checkProxyIP(ip)));

        let statusReport = '```INFORMATION\n';
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
            `Org      : ${r.org}\n\n`;
        }
        statusReport += '```';

        await this.sendMessage(chatId, statusReport);
      } catch (error) {
        console.error('Error checking IP:', error);
        await this.sendMessage(chatId, `Terjadi kesalahan saat cek IP: ${error.message}`);
      }

      // Hapus pesan loading
      if (loadingMsg && loadingMsg.message_id) {
        await this.deleteMessage(chatId, loadingMsg.message_id);
      }
    }

    // Generate Config jika ada proxy URL
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
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
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
