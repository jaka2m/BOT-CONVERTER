  export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    // Menyimpan status menunggu input nomor, key = chatId, value = true/false
    this.waitingForNumbers = new Map();
  }

  // Fungsi utama menerima update dari Telegram (webhook)
  async handleUpdate(update) {
    // Hanya tangani message teks
    if (!update.message || !update.message.text) return;

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // Jika sedang menunggu nomor dari user ini
    if (this.waitingForNumbers.get(chatId)) {
      this.waitingForNumbers.delete(chatId); // reset status
      const inputText = text;

      // Ambil nomor valid: mulai 0, 7-15 digit
      const numbers = inputText.split(/[\s\n]+/).filter(n => /^0\d{6,15}$/.test(n));

      if (numbers.length === 0) {
        await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).");
        return;
      }

      await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`);

      let hasilAkhir = "";
      for (const number of numbers) {
        const hasilCek = await this.cekkuota(number);
        hasilAkhir += `${hasilCek}\n\n`;
      }

      await this.sendMessage(chatId, hasilAkhir.trim());
      return;
    }

    // Jika perintah cekkuota
    if (text.toLowerCase() === "/cekkuota") {
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):");
      this.waitingForNumbers.set(chatId, true);
      return;
    }

    // Respon default
    await this.sendMessage(chatId, "Kirim /cekkuota untuk mulai cek nomor.");
  }

  // Fungsi cek kuota (contoh)
  async cekkuota(number) {
    try {
      const url = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${number}&isJSON=true`;
      const headers = {
        'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
        'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
        'X-App-Version': '4.0.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      const res = await fetch(url, { headers });
      const data = await res.json();

      const dataSp = data?.data?.data_sp;
      if (!dataSp) return `❌ Gagal mendapatkan data untuk *${number}*.`;

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

  // Fungsi kirim pesan ke chat Telegram
  async sendMessage(chatId, text, options = {}) {
    try {
      const payload = { chat_id: chatId, text, parse_mode: "Markdown", ...options };
      const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.ok) console.error("Error kirim pesan:", json);
      return json;
    } catch (e) {
      console.error("Exception kirim pesan:", e);
    }
  }
}
