export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Fungsi utama untuk menerima update Telegram
  async handleUpdate(update) {
    if (!update.message || !update.message.text) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // Cek apakah pesan dimulai dengan /cek diikuti nomor HP
    if (text.toLowerCase().startsWith('/cek')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        return this.sendMessage(chatId, 'Format salah. Gunakan: /cek <nomor_hp>');
      }
      
      const msisdn = parts[1].replace(/[^0-9]/g, ''); // Ambil angka saja dari nomor

      if (!msisdn) {
        return this.sendMessage(chatId, 'Nomor HP tidak valid.');
      }

      try {
        // Panggil API cek kuota
        const resultText = await this.cekKuota(msisdn);
        await this.sendMessage(chatId, resultText);
      } catch (error) {
        await this.sendMessage(chatId, `Terjadi kesalahan saat cek kuota: ${error.message}`);
      }
    } else {
      // Bisa tangani command lain atau abaikan
      return new Response('OK', { status: 200 });
    }
  }

  // Fungsi untuk request cek kuota ke API eksternal
  async cekKuota(msisdn) {
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;

    const request = new Request(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
        "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
        "X-App-Version": "4.0.0",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const response = await fetch(request, {
      cf: {
        // Optional: Cloudflare options, misal cache atau lain
      },
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (!json.status) {
      throw new Error(json.message || "API gagal merespon");
    }

    // Return hasil yang sudah diformat dari API
    return json.data.hasil || "Data kuota tidak tersedia.";
  }

  // Fungsi kirim pesan ke Telegram
  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    return response.json();
  }
}
