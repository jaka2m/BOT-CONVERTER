export async function Cekkuota(nomor) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${nomor}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    const text = await response.text();

    // Cek dulu isi respons, kalau bukan JSON valid, return error
    try {
      const data = JSON.parse(text);

      if (!data || !data.nomor) {
        return '❌ Nomor tidak ditemukan atau diblokir.';
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

    } catch (e) {
      // Kalau parse JSON error, kirim error raw response biar tau apa masalahnya
      return `❌ Response bukan JSON valid:\n${text}`;
    }

  } catch (err) {
    return `❌ Gagal fetch API: ${err.message}`;
  }
}

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
      console.error('Error:', error);
      await this.sendMessage(chatId, `❌ Error: ${error.message}`);
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
