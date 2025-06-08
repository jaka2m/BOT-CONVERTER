import { generateClashConfig, generateNekoboxConfig, generateSingboxConfig } from './configGenerators.js';

// --- Bagian Baru: Untuk menyimpan daftar chatId user ---
let userChatIds = new Set(); // Menggunakan Set untuk menghindari duplikasi chatId
// --- Akhir Bagian Baru ---

export async function Conver(link) {
  console.log("Bot link:", link);
}

export class Converterbot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId; // Pastikan ownerId diinisialisasi
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageId = update.message.message_id;
    const fromId = update.message.from.id; // Mendapatkan ID pengirim pesan

    // --- Bagian Baru: Tambahkan chatId user ke Set saat ada interaksi ---
    userChatIds.add(chatId);
    console.log(`User ${chatId} added to broadcast list. Total users: ${userChatIds.size}`);
    // --- Akhir Bagian Baru ---

    // --- Bagian Baru: Perintah broadcast khusus untuk owner ---
    if (text.startsWith('/broadcast')) {
      if (fromId.toString() !== this.ownerId.toString()) { // Pastikan ownerId adalah string/number yang sesuai
        await this.sendMessage(chatId, '❌ Maaf, perintah ini hanya bisa digunakan oleh owner bot.');
        return new Response('OK', { status: 200 });
      }

      const broadcastMessage = text.substring('/broadcast'.length).trim();
      if (!broadcastMessage) {
        await this.sendMessage(chatId, 'Format: `/broadcast [pesan broadcast]`');
        return new Response('OK', { status: 200 });
      }

      await this.sendMessage(chatId, `🚀 Memulai broadcast ke ${userChatIds.size} pengguna...`);
      await this.sendBroadcastMessage(broadcastMessage);
      await this.sendMessage(chatId, '✅ Broadcast selesai.');
      return new Response('OK', { status: 200 });
    }
    // --- Akhir Bagian Baru ---

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
        // Jika tidak ada perintah atau link, bot bisa diam atau memberikan pesan default.
        // Anda bisa menambahkan pesan default di sini jika perlu.
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true, // Opsional: mencegah preview link otomatis
      ...options
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        console.error(`Failed to send message to ${chatId}:`, data);
      }
      return data;
    } catch (error) {
      console.error(`Error sending message to ${chatId}:`, error);
      return { ok: false, description: error.message };
    }
  }

  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    if (options.reply_to_message_id) {
      formData.append('reply_to_message_id', options.reply_to_message_id.toString());
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/bot${this.token}/sendDocument`, {
        method: 'POST',
        body: formData
      }
      );
      const data = await response.json();
      if (!response.ok) {
        console.error(`Failed to send document to ${chatId}:`, data);
      }
      return data;
    } catch (error) {
      console.error(`Error sending document to ${chatId}:`, error);
      return { ok: false, description: error.message };
    }
  }

  // --- Bagian Baru: Fungsi untuk mengirim broadcast message ---
  async sendBroadcastMessage(message) {
    for (const chatId of userChatIds) {
      console.log(`Sending broadcast to: ${chatId}`);
      // Memberi jeda kecil antar pesan agar tidak terlalu cepat dan menghindari limit rate
      await new Promise(resolve => setTimeout(resolve, 50)); // Jeda 50ms
      const result = await this.sendMessage(chatId, message);
      if (!result.ok) {
        console.warn(`Could not send broadcast to ${chatId}. Reason: ${result.description}`);
        // Anda bisa menambahkan logika untuk menghapus chatId yang tidak valid (misal, bot diblokir user)
        // if (result.description.includes('bot was blocked by the user')) {
        //   userChatIds.delete(chatId);
        //   console.log(`Removed blocked user: ${chatId}`);
        // }
      }
    }
  }
  // --- Akhir Bagian Baru ---
}

// --- Bagian Baru: Penting! Cara inisialisasi bot Anda ---
// Pastikan Anda menginisialisasi Converterbot dengan token dan ownerId Anda.
// Contoh:
// const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; // Ganti dengan token bot Anda
// const OWNER_ID = 'YOUR_TELEGRAM_USER_ID'; // Ganti dengan ID user Telegram Anda (ini akan menjadi admin broadcast)
// const bot = new Converterbot(BOT_TOKEN, 'https://api.telegram.org', OWNER_ID);

// Cara Anda menjalankan bot (misalnya di Cloudflare Workers atau Node.js)
// akan menentukan bagaimana Anda mengekspos `handleUpdate` method.
// Misalnya untuk Cloudflare Workers:
// addEventListener('fetch', event => {
//   event.respondWith(bot.handleUpdate(JSON.parse(await event.request.text())));
// });
// --- Akhir Bagian Baru ---
