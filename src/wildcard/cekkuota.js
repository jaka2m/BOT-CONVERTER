  export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    // State menunggu input nomor per chatId (hanya untuk sementara di memori)
    this.waitingForNumbers = new Map();
  }

  // Fungsi utama menangani update Telegram
  async handleUpdate(update) {
    if (!update.message || !update.message.chat) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/cekkuota')) {
      const args = text.split(' ').slice(1);
      if (args.length === 0) {
        // Minta input nomor
        await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):");
        this.waitingForNumbers.set(chatId, true);
      } else {
        // Langsung proses nomor yang dikirim di command
        const nomorText = args.join(' ');
        await this.processNumbers(chatId, nomorText);
      }
      return new Response('OK', { status: 200 });
    }

    // Jika bot menunggu input nomor untuk chatId ini
    if (this.waitingForNumbers.get(chatId)) {
      await this.processNumbers(chatId, text);
      this.waitingForNumbers.delete(chatId);
      return new Response('OK', { status: 200 });
    }

    // Default reply jika bukan perintah
    await this.sendMessage(chatId, "Kirim /cekkuota untuk mulai cek nomor.");
    return new Response('OK', { status: 200 });
  }

  // Proses input nomor dan kirim hasil cek kuota
  async processNumbers(chatId, nomorText) {
    // Pisahkan input berdasarkan spasi, newline, titik
    const numbers = nomorText.split(/[\s.\n]+/).filter(num => /^0\d{6,15}$/.test(num));

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

    // Edit pesan loading jadi hasil akhir
    try {
      await this.editMessageText(chatId, loadingMessage.message_id, hasilAkhir.trim());
    } catch {
      // Kalau gagal edit, kirim pesan baru
      await this.sendMessage(chatId, hasilAkhir.trim());
    }
  }

  // Fungsi cek kuota nomor
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

  // Fungsi kirim pesan text
  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, parse_mode: 'Markdown', ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
    return data.result;
  }

  // Fungsi edit pesan text (misal dari loading ke hasil)
  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram editMessageText failed: ${JSON.stringify(data)}`);
    return data.result;
  }
}
