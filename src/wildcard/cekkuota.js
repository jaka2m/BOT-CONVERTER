export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    if (text.startsWith('/cekkuota')) {
      await this.sendMessage(chatId, '📌 Kirim nomor (format: 081234567890). Bisa beberapa, pisahkan spasi atau baris baru.');
      return new Response('OK', { status: 200 });
    }

    const numbers = text.split(/[\s\n]+/).filter(num => /^0\d{6,15}$/.test(num));
    if (numbers.length === 0) {
      await this.sendMessage(chatId, '❌ Nomor tidak valid. Gunakan format angka 08xxxxxxxxxx.');
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, `⏳ Memproses ${numbers.length} nomor...`);

    for (const number of numbers) {
      try {
        const result = await this.cekkuota(number);
        await this.sendMessage(chatId, result);
      } catch (err) {
        await this.sendMessage(chatId, `❌ Gagal memproses ${number}:\n${err.message}`);
      }
    }

    return new Response('OK', { status: 200 });
  }

  async cekkuota(number) {
    const url = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${number}&isJSON=true`;
    const headers = {
      'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
      'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
      'X-App-Version': '4.0.0',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await fetch(url, { headers });
    const json = await response.json();

    const d = json?.data?.data_sp;
    if (!d) return `❌ Gagal ambil data dari nomor *${number}*.`;

    let hasil = `📄 *HASIL CEK:*\n\n`;
    hasil += `📱 *Nomor:* ${number}\n`;
    hasil += `🏷️ *Provider:* ${d.prefix?.value || '-'}\n`;
    hasil += `📶 *Status 4G:* ${d.status_4g?.value || '-'}\n`;
    hasil += `🆔 *Dukcapil:* ${d.dukcapil?.value || '-'}\n`;
    hasil += `📅 *Umur Kartu:* ${d.active_card?.value || '-'}\n`;
    hasil += `📆 *Masa Aktif:* ${d.active_period?.value || '-'}\n`;
    hasil += `⛔ *Tenggang:* ${d.grace_period?.value || '-'}\n\n`;

    if (Array.isArray(d.quotas?.value)) {
      for (const group of d.quotas.value) {
        for (const paket of group) {
          const pkg = paket.packages;
          hasil += `📦 *Paket:* ${pkg.name}\n`;
          hasil += `📅 *Aktif s.d:* ${pkg.expDate.replace('T', ' ')}\n`;

          if (Array.isArray(paket.benefits) && paket.benefits.length > 0) {
            for (const b of paket.benefits) {
              hasil += `  └ 🎁 *${b.bname}*\n`;
              hasil += `     • Tipe: ${b.type}\n`;
              hasil += `     • Kuota: ${b.quota}\n`;
              hasil += `     • Sisa: ${b.remaining}\n`;
            }
          } else {
            hasil += `  🚫 Tidak ada benefit.\n`;
          }

          hasil += `-----------------------------\n`;
        }
      }
    } else {
      hasil += `❌ Tidak ada paket aktif.\n`;
    }

    return hasil;
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
  }
}
