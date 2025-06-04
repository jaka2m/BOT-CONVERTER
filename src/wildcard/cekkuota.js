export async function Cekkuota(link) {
  console.log("cek kuota:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return new Response('OK', { status: 200 });
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageThreadId = update.message.message_thread_id;

    if (text.startsWith('/cekkuota')) {
      // Minta input nomor dari user
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):", {
        message_thread_id: messageThreadId
      });

      // Tunggu input berikutnya sekali saja
      this.waitingForInput = true; // Flag manual jika diperlukan
    }

    // Tangani input user setelah perintah /cekkuota
    if (this.waitingForInput && text.match(/^0\d{6,15}/)) {
      this.waitingForInput = false;

      const inputText = text.trim();
      const numbers = inputText.split(/[\s.\n]+/).filter(num => /^0\d{6,15}$/.test(num));

      if (numbers.length === 0) {
        return await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).", {
          message_thread_id: messageThreadId
        });
      }

      const loadingMessage = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`, {
        message_thread_id: messageThreadId
      });

      let hasilAkhir = "";
      for (const number of numbers) {
        const hasilCek = await this.cekkuota(number);
        hasilAkhir += `${hasilCek}\n\n`;
      }

      try {
        await this.editMessageText(chatId, loadingMessage.message_id, hasilAkhir.trim(), {
          parse_mode: "Markdown",
          message_thread_id: messageThreadId
        });
      } catch (error) {
        await this.sendMessage(chatId, hasilAkhir.trim(), {
          parse_mode: "Markdown",
          message_thread_id: messageThreadId
        });
      }
    }

    return new Response('OK', { status: 200 });
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

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json(); // agar kita bisa ambil message_id jika perlu
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = { chat_id: chatId, message_id: messageId, text, ...options };
    await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
  }

  async handleCallbackQuery(callbackQuery) {
    // Kosong sementara, bisa kamu isi logika untuk menangani tombol
    console.log("CallbackQuery received:", callbackQuery);
  }
}
