export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Fungsi utama untuk menangani update dari Telegram
  async handleUpdate(update) {
    // Tangani callback query dulu jika ada
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return new Response('OK', { status: 200 });
    }

    // Jika bukan message, langsung return OK
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const messageThreadId = update.message.message_thread_id;

    // Jika user mengetik /cekkuota
    if (text.startsWith('/cekkuota')) {
      // Kirim pesan minta input nomor
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):", {
        message_thread_id: messageThreadId,
      });

      // Tunggu pesan berikutnya dari user di chat yang sama
      // Catatan: Di environment ini, event listener seperti "bot.once" harus diimplementasi secara custom
      // Di contoh ini, saya buat function listener dummy sebagai contoh,
      // kamu perlu sesuaikan sesuai framework/lingkungan kamu.
      this.waitForNextMessage(chatId, async (response) => {
        const inputText = response.text.trim();
        const numbers = inputText.split(/[\s\n]+/).filter(num => /^0\d{6,15}$/.test(num));

        if (numbers.length === 0) {
          return this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).", {
            message_thread_id: response.message_thread_id,
          });
        }

        // Kirim pesan loading
        const loadingMessage = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`, {
          message_thread_id: response.message_thread_id,
        });

        let hasilAkhir = "";
        for (const number of numbers) {
          const hasilCek = await this.cekkuota(number);
          hasilAkhir += `${hasilCek}\n\n`;
        }

        try {
          // Edit pesan loading dengan hasil
          await this.editMessageText(chatId, loadingMessage.message_id, hasilAkhir.trim(), {
            parse_mode: "Markdown",
            message_thread_id: response.message_thread_id,
          });
        } catch {
          // Kalau edit gagal, kirim pesan baru
          await this.sendMessage(chatId, hasilAkhir.trim(), {
            parse_mode: "Markdown",
            message_thread_id: response.message_thread_id,
          });
        }
      });

      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  // Dummy placeholder, kamu harus implementasi ini sesuai bot framework kamu
  waitForNextMessage(chatId, callback) {
    // Contoh: simpan callback, tunggu event message berikutnya dengan chatId yang sama
    // lalu panggil callback(message)
    // Ini harus diintegrasikan dengan framework Telegram bot yang kamu pakai.
  }

  // Fungsi cek kuota
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

  // Kirim pesan teks
  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // Edit pesan teks
  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // Kirim dokumen (file)
  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
  }
}
