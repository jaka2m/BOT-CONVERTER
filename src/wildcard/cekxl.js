export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Method utama untuk menangani update webhook Telegram
  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/cek')) {
      await this.sendMessage(chatId, 'baik dulu sebelum nanya.');

      // Contoh parsing nomor msisdn setelah perintah /cek
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this.sendMessage(chatId, 'Kirim nomor dengan format: /cek 6287765101308');
        return new Response('OK', { status: 200 });
      }
      const msisdn = parts[1];

      try {
        const data = await this.cekKuota(msisdn);
        // Kirim hasil response ke Telegram
        if (data.status && data.data && data.data.hasil) {
          await this.sendMessage(chatId, `Hasil cek kuota:\n${data.data.hasil.replace(/<br>/g, '\n')}`);
        } else {
          await this.sendMessage(chatId, 'Gagal mendapatkan data kuota.');
        }
      } catch (err) {
        await this.sendMessage(chatId, `Error saat cek kuota: ${err.message}`);
      }
    }

    return new Response('OK', { status: 200 });
  }

  // Method kirim pesan teks ke chat Telegram
  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });
    return response.json();
  }

  // Method cek kuota ke API eksternal
  async cekKuota(msisdn) {
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${encodeURIComponent(msisdn)}&isJSON=true`;

    const headers = {
      Authorization: "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
      "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
      "X-App-Version": "4.0.0",
      // Jangan sertakan content-type di GET request
      "User-Agent": "Mozilla/5.0",
    };

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // (Opsional) Method kirim dokumen ke Telegram (jika kamu ingin kirim file)
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
