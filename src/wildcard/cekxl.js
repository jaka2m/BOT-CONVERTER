// worker.js

// ===============================
// 1. Stub fungsi Cekkuota(link) — hanya logging
// ===============================
export async function Cekkuota(link) {
  console.log("Bot link:", link);
  // (Anda bisa menambahkan logika lain di sini jika diperlukan)
}

// ===============================
// 2. Helper function untuk cek kuota tiap nomor (sesuai format JSON terbaru)
// ===============================
async function _cekkuota(number) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    // Tangani respons non-JSON
    let data;
    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text();
      return `❌ Gagal cek *${number}*:\n\`\`\`\n${text}\n\`\`\``;
    }

    // Validasi struktur
    if (!data || !data.nomor) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }

    // Rangkuman Info Pelanggan
    let out = [
      `📲 *Cek Nomor:* ${data.nomor}`,
      `🏷️ *Provider:* ${data.provider || '-'}`,
      `📅 *Umur Kartu:* ${data.umur_kartu || '-'}`,
      `📶 *Status SIM:* ${data.status_simcard || '-'}`,
      `🆔 *Status Dukcapil:* ${data.status_dukcapil || '-'}`,
      `🗓️ *Masa Aktif:* ${data.masa_aktif || '-'}`,
      `⏳ *Masa Tenggang:* ${data.masa_tenggang || '-'}`
    ].join('\n');

    // Rangkuman Paket Aktif
    if (Array.isArray(data.paket_aktif) && data.paket_aktif.length > 0) {
      out += `\n\n📦 *Paket Aktif:*`;
      data.paket_aktif.forEach((paket, idx) => {
        out += `\n\n${idx + 1}. 🎁 *${paket.nama_paket}*`;
        out += `\n   📆 *Masa Aktif:* ${paket.masa_aktif || '-'}`;
        if (Array.isArray(paket.benefits) && paket.benefits.length > 0) {
          paket.benefits.forEach(b => {
            out += `\n     ▫️ ${b}`;
          });
        } else {
          out += `\n     🚫 Tidak ada benefit detail.`;
        }
      });
    } else {
      out += `\n\n🚫 Tidak ada paket aktif.`;
    }

    return out;
  } catch (e) {
    return `❌ Error cek *${number}*: ${e.message}`;
  }
}

// ===============================
// 3. Kelas TelegramCekkuota (stateless)
// ===============================
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token  = token;
    this.apiUrl = apiUrl;
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  // Kirim pesan ke Telegram
  async sendMessage(chatId, text, opts = {}) {
    const url  = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...opts };
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
  }

  // Handler setiap update Telegram
  async handleUpdate(update) {
    if (!update.message) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text   = (update.message.text || '').trim();

    // Jika perintah /cekkuota
    if (text === '/cekkuota') {
      await this.sendMessage(
        chatId,
        '📌 *Masukkan nomor HP, 1 nomor per baris.*\nMaksimal *20* nomor.\n\nKirim nomor sekarang.',
        { parse_mode: 'Markdown' }
      );
      return new Response('OK', { status: 200 });
    }

    // Jika bukan perintah (tidak diawali "/"), anggap daftar nomor
    if (!text.startsWith('/')) {
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l);

      if (lines.length === 0) {
        return new Response('OK', { status: 200 });
      }
      if (lines.length > 20) {
        await this.sendMessage(
          chatId,
          '⚠️ Maksimal 20 nomor saja. Silakan kirim ulang daftar nomor HP.',
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      const invalid = lines.filter(n => !/^0\d{6,15}$/.test(n));
      if (invalid.length) {
        await this.sendMessage(
          chatId,
          `⚠️ Nomor tidak valid:\n${invalid.join('\n')}\n\nSilakan kirim ulang dengan format benar.`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      // Kirim loading
      await this.sendMessage(
        chatId,
        `⏳ Memproses ${lines.length} nomor, mohon tunggu...`
      );

      // Proses cek kuota
      let reply = '';
      for (const num of lines) {
        reply += await _cekkuota(num) + '\n\n';
      }

      // Kirim hasil
      await this.sendMessage(
        chatId,
        reply.trim(),
        { parse_mode: 'Markdown' }
      );
      return new Response('OK', { status: 200 });
    }

    // Abaikan perintah lain
    return new Response('OK', { status: 200 });
  }
}

