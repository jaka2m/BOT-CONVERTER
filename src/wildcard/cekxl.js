// Fungsi utama untuk ambil info kuota
export async function Cekkuota(link) {
  const url = `https://dompul.free-accounts.workers.dev/?number=${link}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const text = await response.text();

    if (!response.ok || text.includes('error code') || text.includes('1042')) {
      return '❌ Nomor tidak ditemukan atau diblokir.';
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

    if (data.paket_aktif && data.paket_aktif.length > 0) {
      pesan += `📦 *Paket Aktif:*\n`;
      data.paket_aktif.forEach((paket, i) => {
        pesan += ` ${i + 1}. ${paket.nama_paket}\n    Aktif sampai: ${paket.masa_aktif}\n`;
      });
    } else {
      pesan += `📦 Tidak ada paket aktif.\n`;
    }

    return pesan;

  } catch (e) {
    console.error('Cekkuota error:', e);
    return '❌ Gagal menghubungi server atau mengurai data.';
  }
}

// Kelas bot Telegram
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
          await this.sendMessage(chatId, '❗ Format salah.\nGunakan: /cek <nomor>');
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
      text,
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
