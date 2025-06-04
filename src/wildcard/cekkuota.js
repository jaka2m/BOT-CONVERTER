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
      await this.sendMessage(chatId, '📌 Silakan kirim nomor yang ingin dicek (format: 081234567890 atau beberapa nomor dipisah spasi/baris baru).');
      return new Response('OK', { status: 200 });
    }

    const numbers = text.split(/[\s\n]+/).filter(num => /^0\d{6,15}$/.test(num));
    if (numbers.length === 0) {
      await this.sendMessage(chatId, '❌ Nomor tidak valid. Gunakan format yang benar.');
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, `⏳ Memproses ${numbers.length} nomor...`);

    for (const number of numbers) {
      try {
        const result = await this.cekkuota(number);
        await this.sendMessage(chatId, result);
      } catch (err) {
        await this.sendMessage(chatId, `❌ Gagal memproses ${number}: ${err.message}`);
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
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
      const response = await fetch(url, { headers });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        return `❌ Gagal mendapatkan data JSON dari server untuk nomor ${number}.\nRespons bukan JSON:\n${text.slice(0, 200)}`;
      }

      const data = await response.json();

      const dataSp = data?.data?.data_sp;
      if (!dataSp) {
        return `❌ Gagal mendapatkan data untuk nomor ${number}.`;
      }

      let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${number}
🏷️ *Provider:* ${dataSp.prefix?.value || '-'}
⌛️ *Umur Kartu:* ${dataSp.active_card?.value || '-'}
📶 *Status Simcard:* ${dataSp.status_4g?.value || '-'}
📋 *Status Dukcapil:* ${dataSp.dukcapil?.value || '-'}
⏳ *Masa Aktif:* ${dataSp.active_period?.value || '-'}
⚠️ *Masa Tenggang:* ${dataSp.grace_period?.value || '-'}`;

      let infoPaket = `\n\n📦 *Paket Aktif:*\n`;

      if (dataSp.quotas?.success && Array.isArray(dataSp.quotas.value)) {
        for (const paketGroup of dataSp.quotas.value) {
          for (const paket of paketGroup) {
            const pkg = paket.packages;
            const benefits = paket.benefits;

            infoPaket += `
🎁 *Nama Paket:* ${pkg.name}
📅 *Masa Aktif:* ${pkg.expDate}`;

            if (benefits && benefits.length > 0) {
              for (const benefit of benefits) {
                infoPaket += `
  ─ 📌 *Benefit:* ${benefit.bname}
     🧧 *Tipe:* ${benefit.type}
     💾 *Kuota:* ${benefit.quota}
     ✅ *Sisa:* ${benefit.remaining}`;
              }
            } else {
              infoPaket += `
  🚫 Tidak ada detail benefit.`;
            }

            infoPaket += `\n-----------------------------\n`;
          }
        }
      } else {
        infoPaket += `❌ Tidak ada paket aktif.`;
      }

      return infoPelanggan + infoPaket;
    } catch (err) {
      return `❌ Gagal request data untuk nomor ${number}: ${err.message}`;
    }
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown"
      })
    });
    return response.json();
  }
}
