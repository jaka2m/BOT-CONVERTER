export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.waitingForNumbers = new Map(); // chatId => boolean
  }

  async handleUpdate(update) {
    if (!update.message) return { status: 200, message: 'No message' };

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    if (this.waitingForNumbers.get(chatId)) {
      this.waitingForNumbers.delete(chatId);

      const numbers = text
        .split(/[\s\n]+/)
        .filter(num => /^0\d{6,15}$/.test(num));

      if (numbers.length === 0) {
        await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).");
        return { status: 200 };
      }

      const loadingMsg = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`);

      let hasilAkhir = "";
      for (const number of numbers) {
        const hasilCek = await this.cekkuota(number);
        hasilAkhir += `${hasilCek}\n\n`;
      }

      await this.editMessageText(chatId, loadingMsg.result.message_id, hasilAkhir.trim());
      return { status: 200 };
    }

    if (text.startsWith('/cekkuota')) {
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):");
      this.waitingForNumbers.set(chatId, true);
      return { status: 200 };
    }

    return { status: 200 };
  }

  async cekkuota(number) {
    try {
      const url = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${number}&isJSON=true`;
      const headers = {
        'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
        'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
        'X-App-Version': '4.0.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const response = await fetch(url, { headers });
      const data = await response.json();
      const dataSp = data?.data?.data_sp;

      if (!dataSp) {
        return `❌ Gagal mendapatkan data untuk *${number}*.`;
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

            if (benefits?.length > 0) {
              for (const benefit of benefits) {
                infoPaket += `
  ─ 📌 *Benefit:* ${benefit.bname}
     🧧 *Tipe:* ${benefit.type}
     💾 *Kuota:* ${benefit.quota}
     ✅ *Sisa:* ${benefit.remaining}`;
              }
            } else {
              infoPaket += `\n  🚫 Tidak ada detail benefit.`;
            }

            infoPaket += `\n-----------------------------\n`;
          }
        }
      } else {
        infoPaket += `❌ Tidak ada paket aktif.`;
      }

      return infoPelanggan + infoPaket;
    } catch (error) {
      console.error("Gagal cek kuota:", error);
      return `❌ *Terjadi kesalahan saat memeriksa nomor ${number}.*`;
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

  async editMessageText(chatId, messageId, text) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown"
      })
    });
    return response.json();
  }

  async startPolling() {
    console.log("Bot is polling for updates...");
    let offset = 0;

    while (true) {
      try {
        const res = await fetch(`${this.apiUrl}/bot${this.token}/getUpdates?offset=${offset}&timeout=30`);
        const json = await res.json();

        if (json.ok && Array.isArray(json.result)) {
          for (const update of json.result) {
            offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }
  }
}
