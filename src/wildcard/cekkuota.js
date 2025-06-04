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
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${text.slice(0, 100)}`);
    }

    const data = await response.json();

    if (!data?.data?.data_sp) {
      throw new Error(`Data pelanggan tidak ditemukan di response:\n${JSON.stringify(data).slice(0, 300)}`);
    }

    const sp = data.data.data_sp;

    // Bangun pesan format Markdown
    let msg = `📌 *Info Pelanggan:*\n`;
    msg += `🔢 *Nomor:* ${number}\n`;
    msg += `🏷️ *Tipe Kartu:* ${sp.prefix?.value || '-'}\n`;
    msg += `⌛️ *Umur Kartu:* ${sp.active_card?.value || '-'}\n`;
    msg += `📶 *Status 4G:* ${sp.status_4g?.value || '-'}\n`;
    msg += `📋 *Status Dukcapil:* ${sp.dukcapil?.value || '-'}\n`;
    msg += `⏳ *Masa Aktif:* ${sp.active_period?.value || '-'}\n`;
    msg += `⚠️ *Masa Tenggang:* ${sp.grace_period?.value || '-'}\n\n`;

    msg += `📦 *Paket Aktif:*\n`;

    if (sp.quotas?.success && Array.isArray(sp.quotas.value)) {
      for (const paketGroup of sp.quotas.value) {
        for (const paket of paketGroup) {
          const pkg = paket.packages;
          msg += `🎁 *Nama Paket:* ${pkg.name}\n`;
          msg += `📅 *Aktif Hingga:* ${pkg.expDate.replace('T', ' ').replace('Z', '')}\n`;

          if (paket.benefits.length > 0) {
            for (const benefit of paket.benefits) {
              msg += `\n📌 *Benefit:* ${benefit.bname}\n`;
              msg += `   🧾 *Tipe Kuota:* ${benefit.type}\n`;
              msg += `   💾 *Kuota:* ${benefit.quota}\n`;
              msg += `   ✅ *Sisa Kuota:* ${benefit.remaining}\n`;
            }
          } else {
            msg += `\n🚫 Tidak ada benefit.\n`;
          }
          msg += `------------------------------\n`;
        }
      }
    } else {
      msg += `❌ Tidak ada paket aktif.\n`;
    }

    return msg;
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
    return response.json();
  }
}
