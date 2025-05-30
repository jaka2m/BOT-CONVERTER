import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';

export async function converterku(link) {
  console.log("Bot link:", link);
}

export class ConverterBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Tanggapi perintah /converter
    if (text.startsWith('/converter')) {
      await this.sendMessage(
        chatId,
        `🤖 *Geo Project Bot*

Kirimkan link konfigurasi V2Ray dan saya *SPIDER - MAN* akan mengubahnya ke format *Singbox, Nekobox*, dan *Clash*.

*Contoh:*
\`vless://...\`
\`vmess://...\`
\`trojan://...\`
\`ss://...\`

📌 *Catatan:*
- Maksimal 10 link per INPUT.
- Disarankan menggunakan *Singbox* versi *1.10.3* atau *1.11.8*.

Salin dan kirim sekarang! 🕷️
`,
        'Markdown'
      );
      return new Response('OK', { status: 200 });
    }

    // Jika ada teks berformat link
    if (text.includes('://')) {
      try {
        // Filter hanya link dengan protokol valid
        const validProtocols = ['vmess://', 'vless://', 'trojan://', 'ss://'];
        const links = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => validProtocols.some(protocol => line.startsWith(protocol)))
          .slice(0, 10); // Maksimal 10 link

        // Jika tidak ada link valid
        if (links.length === 0) {
          return new Response('OK', { status: 200 }); // Tidak membalas
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
        await this.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
      }

      return new Response('OK', { status: 200 });
    }

    // Selain dari itu, tidak balas apa-apa
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, parseMode = 'Markdown') {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`, {
        method: 'POST',
        body: formData
      }
    );

    return response.json();
  }
}
