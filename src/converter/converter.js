import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';

// Set untuk menyimpan semua chatId pengguna secara unik
// CATATAN: Untuk penggunaan produksi, Anda harus menggunakan database persisten.
const userChats = new Set();

export async function Conver(link) {
  console.log("Bot link:", link);
}

export class Converterbot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageId = update.message.message_id;

    // Tambahkan chatId pengguna ke daftar setiap kali ada interaksi
    userChats.add(chatId);
    console.log(`User ${chatId} added. Total users: ${userChats.size}`);

    // Perintah untuk broadcast (hanya bisa oleh ownerId)
    if (text.startsWith('/broadcast') && chatId.toString() === this.ownerId.toString()) {
      const broadcastMessage = text.substring('/broadcast '.length).trim();
      if (broadcastMessage) {
        await this.sendBroadcastMessage(broadcastMessage);
      } else {
        await this.sendMessage(chatId, 'Contoh penggunaan: `/broadcast Pesan yang ingin Anda siarkan.`');
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/converter')) {
      await this.sendMessage(
        chatId,
        `🤖 *Geo Project Bot*\n\nKirimkan link konfigurasi V2Ray dan saya *SPIDERMAN* akan mengubahnya ke format *Singbox*, *Nekobox*, dan *Clash*.\n\nContoh:\n\`vless://...\`\n\`vmess://...\`\n\`trojan://...\`\n\`ss://...\`\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan *Singbox versi 1.10.3* atau *1.11.8*.`,
        { reply_to_message_id: messageId }
      );
      return new Response('OK', { status: 200 });
    }

    if (text.includes('://')) {
      try {
        const links = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('://'))
          .slice(0, 10);

        if (links.length === 0) {
          await this.sendMessage(chatId, '❌ Tidak ada link valid yang ditemukan. Kirimkan link VMess, VLESS, Trojan, atau Shadowsocks.', { reply_to_message_id: messageId });
          return new Response('OK', { status: 200 });
        }

        const clashConfig = generateClashConfig(links, true);
        const nekoboxConfig = generateNekoboxConfig(links, true);
        const singboxConfig = generateSingboxConfig(links, true);

        await this.sendDocument(chatId, clashConfig, 'clash.yaml', 'text/yaml', { reply_to_message_id: messageId });
        await this.sendDocument(chatId, nekoboxConfig, 'nekobox.json', 'application/json', { reply_to_message_id: messageId });
        await this.sendDocument(chatId, singboxConfig, 'singbox.bpf', 'application/json', { reply_to_message_id: messageId });

      } catch (error) {
        console.error('Error processing links:', error);
        await this.sendMessage(chatId, `Error: ${error.message}`, { reply_to_message_id: messageId });
      }
    } else {
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    if (options.reply_to_message_id) {
      formData.append('reply_to_message_id', options.reply_to_message_id.toString());
    }

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    }
    );

    return response.json();
  }

  // Fungsi baru untuk broadcast pesan
  async sendBroadcastMessage(message) {
    let successCount = 0;
    let failCount = 0;

    for (const chatId of userChats) {
      try {
        await this.sendMessage(chatId, message);
        successCount++;
        // Tambahkan delay kecil antar pesan untuk menghindari batasan rate Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Gagal mengirim pesan ke ${chatId}:`, error);
        failCount++;
        // Opsional: Hapus chatId jika user telah memblokir bot
        if (error.description && (error.description.includes('bot was blocked by the user') || error.description.includes('chat not found'))) {
          userChats.delete(chatId);
        }
      }
    }

    // Kirim laporan broadcast ke owner
    const totalUsers = userChats.size; // Jumlah user yang masih terdaftar
    const broadcastReport = `Pesan broadcast telah dikirimkan.\n\nTotal user terdaftar: *${totalUsers}*\nBerhasil dikirim: *${successCount}*\nGagal dikirim: *${failCount}*`;
    await this.sendMessage(this.ownerId, broadcastReport);
  }
}
