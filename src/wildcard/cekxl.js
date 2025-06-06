export async function Cekkuota(msisdn) {
  const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;

  const headers = {
    Authorization: "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
    "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
    "X-App-Version": "4.0.0",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0",
  };

  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (!json.status) {
      throw new Error(`API error: ${json.message || 'unknown error'}`);
    }

    return json.data.hasil; // string hasil untuk dikirim ke Telegram

  } catch (err) {
    console.error(err);
    return `Terjadi kesalahan saat cek kuota: ${err.message}`;
  }
}

export class TelegramCekkuota {
  constructor(token, apiUrl = "https://api.telegram.org") {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response("OK", { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || "";

    if (text.startsWith("/cek")) {
      const parts = text.split(" ");
      if (parts.length < 2) {
        await this.sendMessage(chatId, "Format: /cek <nomor_hp>\nContoh: /cek 6287765101308");
        return new Response("OK", { status: 200 });
      }

      const msisdn = parts[1].trim();

      await this.sendMessage(chatId, "Sedang mengecek kuota, mohon tunggu...");

      const hasil = await Cekkuota(msisdn);

      await this.sendMessage(chatId, hasil);
    }

    return new Response("OK", { status: 200 });
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return response.json();
  }
}
