export async function Cekkuota(link) {
  console.log("cek kuota:", link);
}


export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async editMessage(chatId, messageId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    };
    await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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

            if (benefits && benefits.length > 0) {
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

  async handleCommand(bot, msg) {
    const text = msg.text || '';
    if (!text.startsWith('/cekkuota')) return;

    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id;

    await bot.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):", {
      message_thread_id: threadId
    });

    bot.once("message", async (response) => {
      const userChatId = response.chat.id;
      const userThreadId = response.message_thread_id;
      const inputText = response.text.trim();

      const numbers = inputText.split(/[\s.\n]+/).filter(num => /^0\d{6,15}$/.test(num));

      if (numbers.length === 0) {
        return bot.sendMessage(userChatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).", {
          message_thread_id: userThreadId
        });
      }

      const loadingMessage = await bot.sendMessage(userChatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`, {
        message_thread_id: userThreadId
      });

      let hasilAkhir = "";
      for (const number of numbers) {
        const hasil = await this.cekkuota(number);
        hasilAkhir += `${hasil}\n\n`;
      }

      try {
        await bot.editMessageText(hasilAkhir.trim(), {
          chat_id: userChatId,
          message_id: loadingMessage.message_id,
          parse_mode: "Markdown",
          message_thread_id: userThreadId
        });
      } catch {
        await bot.sendMessage(userChatId, hasilAkhir.trim(), {
          parse_mode: "Markdown",
          message_thread_id: userThreadId
        });
      }
    });
  }
}
