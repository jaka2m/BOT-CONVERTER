export async function Cekkuota(msisdn) {
  const apicheck = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${encodeURIComponent(msisdn)}&isJSON=true`;
  const headers = {
    Authorization: "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
    "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
    "X-App-Version": "4.0.0",
    "User-Agent": "Mozilla/5.0",
  };

  const response = await fetch(apicheck, { method: 'GET', headers });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return response.json();
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

    if (text.startsWith('/cek')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        return await this.sendMessage(chatId, 'Format salah, contoh: /cek 6287765101308');
      }
      const msisdn = parts[1];
      try {
        const result = await Cekkuota(msisdn);
        await this.sendMessage(chatId, `Hasil cek kuota:\n${result.data.hasil}`);
      } catch (err) {
        await this.sendMessage(chatId, `Terjadi kesalahan saat cek kuota: ${err.message}`);
      }
    } else {
      await this.sendMessage(chatId, 'Perintah tidak dikenali.');
    }

    return new Response('OK', { status: 200 });
  }

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
}
