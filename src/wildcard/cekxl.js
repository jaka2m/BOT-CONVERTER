// Fungsi utama untuk fetch dan format data kuota
export async function Cekkuota(nomor) {
  console.log("Memproses nomor:", nomor);
  const url = `https://dompul.free-accounts.workers.dev/?number=${nomor}`;

  const headers = {
    'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
    'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
    'X-App-Version': '4.0.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Referer': 'https://dompul.free-accounts.workers.dev/'
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      if (text.includes('1042')) {
        return '❌ Nomor tidak ditemukan atau diblokir.';
      }
      return `❌ Error dari API: HTTP ${response.status} - ${response.statusText}`;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return `❌ Server mengembalikan format tidak dikenal: ${text}`;
    }

    const data = await response.json();

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

    data.paket_aktif.forEach((paket, i) => {
      pesan += ` ${i + 1}. ${paket.nama_paket}\n    Aktif sampai: ${paket.masa_aktif}\n`;
    });

    return pesan;
  } catch (error) {
    console.error('Fetch error:', error);
    return `❌ Gagal memproses permintaan: ${error.message}`;
  }
}

// Kelas handler Telegram
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    try {
      if (text.startsWith('/cek')) {
        const parts = text.split(/\s+/);
        const nomor = parts[1];

        if (!nomor || !/^\d{10,15}$/.test(nomor)) {
          await this.sendMessage(chatId, '❗ Format salah.\nGunakan: /cek <nomor>\nContoh: /cek 087756116610');
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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return res.json();
  }
}

