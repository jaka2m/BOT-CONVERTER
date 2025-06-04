export async function Cekkuota(link) {
  console.log("cek kuota:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/cekkuota/, (msg) => this.handleCekKuotaCommand(msg));
  }

  async handleCekKuotaCommand(msg) {
    const chatId = msg.chat.id;
    const messageThreadId = msg.message_thread_id;

    // Minta input nomor dari user
    await this.bot.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):", {
      message_thread_id: messageThreadId
    });

    // Tunggu input berikutnya sekali saja
    const response = await this.waitForNextMessage(chatId);

    if (!response || !response.text) {
      return this.bot.sendMessage(chatId, "❌ Tidak menerima input nomor.", { message_thread_id: messageThreadId });
    }

    const inputText = response.text.trim();
    const numbers = inputText.split(/[\s.\n]+/).filter(num => /^0\d{6,15}$/.test(num));

    if (numbers.length === 0) {
      return this.bot.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).", {
        message_thread_id: messageThreadId
      });
    }

    // Kirim pesan loading
    const loadingMessage = await this.bot.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`, {
      message_thread_id: messageThreadId
    });

    let hasilAkhir = "";
    for (const number of numbers) {
      const hasilCek = await this.cekkuota(number);
      hasilAkhir += `${hasilCek}\n\n`;
    }

    try {
      // Edit pesan loading dengan hasil
      await this.bot.editMessageText(hasilAkhir.trim(), {
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        parse_mode: "Markdown",
        message_thread_id: messageThreadId
      });
    } catch (error) {
      // Jika gagal edit pesan, kirim pesan baru
      await this.bot.sendMessage(chatId, hasilAkhir.trim(), {
        parse_mode: "Markdown",
        message_thread_id: messageThreadId
      });
    }
  }

  waitForNextMessage(chatId, timeout = 60000) {
    return new Promise((resolve) => {
      const onMessage = (msg) => {
        if (msg.chat.id === chatId) {
          this.bot.removeListener('message', onMessage);
          clearTimeout(timer);
          resolve(msg);
        }
      };
      this.bot.on('message', onMessage);

      const timer = setTimeout(() => {
        this.bot.removeListener('message', onMessage);
        resolve(null);
      }, timeout);
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
    } catch (error) {
      console.error("Gagal cek kuota:", error);
      return `❌ *Terjadi kesalahan saat memeriksa nomor ${number}.*`;
    }
  }
}
