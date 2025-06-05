// Fungsi untuk ambil dan format data kuota
export async function Cekkuota(nomor) {
  console.log("Bot nomor:", nomor);
  const url = `https://dompul.free-accounts.workers.dev/?number=${nomor}`;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Tangani jika error dari server
    if (!response.ok) {
      if (text.includes('1042')) {
        return '❌ Nomor tidak ditemukan atau diblokir.';
      }
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // Pastikan konten JSON
    if (!contentType.includes('application/json')) {
      throw new Error(`❌ Format tidak dikenal: ${text}`);
    }

    const data = JSON.parse(text);

    if (!data.nomor) {
      return '❌ Data tidak ditemukan atau nomor tidak valid.';
    }

    let pesan = `📱 *Nomor:* ${data.nomor}\n`;
    pesan += `📡 *Provider:* ${data.provider}\n`;
    pesan += `📅 *Umur Kartu:* ${data.umur_kartu}\n`;
    pesan += `📶 *Status SIM:* ${data.status_simcard}\n`;
    pesan += `📇 *Dukcapil:* ${data.status_dukcapil}\n`;
    pesan += `📆 *Masa Aktif:* ${data.masa_aktif}\n`;
    pesan += `⏳ *Masa Tenggang:* ${data.masa_tenggang}\n\n`;
    pesan += `📦 *Paket Aktif:*\n`;

    if (data.paket_aktif.length === 0) {
      pesan += ` - Tidak ada paket aktif\n`;
    } else {
      data.paket_aktif.forEach((paket, i) => {
        pesan += ` ${i + 1}. ${paket.nama_paket}\n    Aktif sampai: ${paket.masa_aktif}\n`;
      });
    }

    return pesan;
  } catch (err) {
    console.error('Cekkuota error:', err);
    return `❌ Terjadi kesalahan:\n${err.message}`;
  }
}

// Kelas Bot Telegram
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    try {
      if (text.startsWith('/cek')) {
        const parts = text.split(' ');
        const nomor = parts[1];

        if (!nomor) {
          await this.sendMessage(chatId, '❗ Format salah.\nKirim: /cek <nomor>');
        } else if (!/^\d{10,13}$/.test(nomor)) {
          await this.sendMessage(chatId, '❗ Nomor tidak valid. Hanya angka 10–13 digit.');
        } else {
          const hasil = await Cekkuota(nomor);
          await this.sendMessage(chatId, hasil, { parse_mode: 'Markdown' });
        }
      } else {
        await this.sendMessage(chatId, '📌 Kirim perintah: /cek <nomor>\nContoh: /cek 087756116610');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      await this.sendMessage(chatId, `❌ Terjadi kesalahan:\n${error.message}`);
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return response.json();
  }
}
