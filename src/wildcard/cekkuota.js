export async function Cekkuota(msisdn) {
  const url = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;
  const headers = {
    'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
    'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
    'X-App-Version': '4.0.0',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  try {
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!data.status || !data.data) {
      return `❌ Gagal mengambil data untuk nomor ${msisdn}`;
    }

    const hasil = data.data.hasil || 'Tidak ada data hasil';
    const text = hasil
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, ''); // hapus tag HTML

    return `📊 *Hasil Cek Kuota*\n\n${text}`;
  } catch (error) {
    return `❌ Terjadi kesalahan saat cek nomor ${msisdn}: ${error.message}`;
  }
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.waitingForNumbers = new Map();
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  }

  async handleUpdate(update) {
    if (update.message) {
      const { chat, text } = update.message;
      const chatId = chat.id;

      if (text === '/start') {
        await this.sendMessage(chatId, '📲 Selamat datang! Ketik /cekkuota untuk mulai cek kuota.');
        return;
      }

      if (text === '/cekkuota') {
        this.waitingForNumbers.set(chatId, true);
        await this.sendMessage(
          chatId,
          '📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):'
        );
        return;
      }

      if (this.waitingForNumbers.get(chatId)) {
        this.waitingForNumbers.set(chatId, false);

        const numbers = text
          .split(/\s+/)
          .map((n) => n.replace(/^0/, '62').trim())
          .filter((n) => /^62\d{9,12}$/.test(n));

        if (numbers.length === 0) {
          await this.sendMessage(chatId, '⚠️ Nomor tidak valid. Coba lagi dengan format yang benar.');
          return;
        }

        for (const num of numbers) {
          const result = await Cekkuota(num);
          await this.sendMessage(chatId, result);
        }

        return;
      }

      await this.sendMessage(chatId, '❓ Perintah tidak dikenali. Kirim /cekkuota untuk mulai.');
    }
  }
}
