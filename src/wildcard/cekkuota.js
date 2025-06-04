export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    // Map menyimpan status chatId yang sedang menunggu input nomor
    this.waitingForNumbers = new Map();
  }

  // Fungsi utama menangani update Telegram
  async handleUpdate(update) {
    if (update.callback_query) {
      // Kalau mau handle callback_query, buat fungsi handleCallbackQuery sendiri
      // await this.handleCallbackQuery(update.callback_query);
      return new Response('OK', { status: 200 });
    }

    if (!update.message || !update.message.chat) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Kalau chat ini sedang menunggu input nomor
    if (this.waitingForNumbers.get(chatId)) {
      // Proses input nomor
      await this.processNumbers(chatId, text);
      // Setelah diproses, hapus status menunggu nomor
      this.waitingForNumbers.delete(chatId);
      return new Response('OK', { status: 200 });
    }

    // Jika user kirim perintah /cekkuota
    if (text.startsWith('/cekkuota')) {
      this.waitingForNumbers.set(chatId, true);
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):");
      return new Response('OK', { status: 200 });
    }

    // Respon default kalau bukan perintah atau bukan input nomor
    await this.sendMessage(chatId, "Kirim /cekkuota untuk mulai cek nomor.");
    return new Response('OK', { status: 200 });
  }

  // Proses input nomor yang dimasukkan user
  async processNumbers(chatId, text) {
    const inputText = text.trim();
    // Split berdasarkan spasi, titik, atau baris baru
    const numbers = inputText.split(/[\s.\n]+/).filter(num => /^0\d{6,15}$/.test(num));

    if (numbers.length === 0) {
      await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).");
      return;
    }

    const loadingMessage = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`);

    let hasilAkhir = "";
    for (const number of numbers) {
      const hasilCek = await this.cekkuota(number);
      hasilAkhir += `${hasilCek}\n\n`;
    }

    try {
      // Edit pesan loading jadi hasil akhir
      await this.editMessageText(chatId, loadingMessage.message_id, hasilAkhir.trim());
    } catch (error) {
      // Kalau gagal edit pesan, kirim pesan baru
      await this.sendMessage(chatId, hasilAkhir.trim());
    }
  }

  // Fungsi cek kuota yang memanggil API eksternal
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

  // Kirim pesan teks ke chat Telegram
  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, parse_mode: 'Markdown', ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Failed to send message:', await res.text());
    }
    return await res.json();
  }

  // Edit pesan yang sudah dikirim (mengubah teks pesan)
  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Failed to edit message:', await res.text());
    }
    return await res.json();
  }
}
