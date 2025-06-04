export async function Cekkuota(number) {
  console.log("Cek kuota nomor:", number);

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

    if (!data || !data.data || !data.data.data_sp) {
      return `❌ Gagal mendapatkan data untuk nomor *${number}*.`;
    }

    const dataSp = data.data.data_sp;

    let result = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${number}
🏷️ *Provider:* ${dataSp.prefix?.value || '-'}
⌛️ *Umur Kartu:* ${dataSp.active_card?.value || '-'}
📶 *Status Simcard:* ${dataSp.status_4g?.value || '-'}
📋 *Status Dukcapil:* ${dataSp.dukcapil?.value || '-'}
⏳ *Masa Aktif:* ${dataSp.active_period?.value || '-'}
⚠️ *Masa Tenggang:* ${dataSp.grace_period?.value || '-'}
`;

    // Paket aktif dan kuota
    if (dataSp.quotas?.success && Array.isArray(dataSp.quotas.value)) {
      result += `\n📦 *Paket Aktif:*\n`;
      for (const paketGroup of dataSp.quotas.value) {
        for (const paket of paketGroup) {
          const pkg = paket.packages;
          const benefits = paket.benefits || [];
          result += `🎁 *Nama Paket:* ${pkg.name}\n📅 *Masa Aktif:* ${pkg.expDate}\n`;
          if (benefits.length === 0) {
            result += `  🚫 Tidak ada benefit.\n`;
          } else {
            for (const benefit of benefits) {
              result += `  ─ 📌 *Benefit:* ${benefit.bname}\n     🧧 *Tipe:* ${benefit.type}\n     💾 *Kuota:* ${benefit.quota}\n     ✅ *Sisa:* ${benefit.remaining}\n`;
            }
          }
          result += `-----------------------------\n`;
        }
      }
    } else {
      result += `\n❌ Tidak ada paket aktif.\n`;
    }

    return result;
  } catch (err) {
    console.error("Error cek kuota:", err);
    return `❌ Terjadi kesalahan saat memeriksa nomor *${number}*.`;
  }
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.waitingForNumbers = new Map(); // chatId => true/false, menyimpan state apakah bot menunggu nomor HP
  }

  async handleUpdate(update) {
    // Tangani callback_query jika ada (opsional)
    if (update.callback_query) {
      // Bisa tambahkan handler callback query di sini jika perlu
      return new Response('OK', { status: 200 });
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (this.waitingForNumbers.get(chatId)) {
      // Bot sedang menunggu input nomor dari user
      const inputText = text.trim();
      // Pisahkan input berdasar spasi atau newline, validasi format nomor minimal 7 digit diawali 0
      const numbers = inputText.split(/[\s\n]+/).filter(n => /^0\d{6,15}$/.test(n));

      if (numbers.length === 0) {
        await this.sendMessage(chatId, "❌ Nomor tidak valid. Silakan masukkan nomor yang benar, contoh: 081234567890");
      } else {
        // Kirim pesan loading dulu
        const loadingMsg = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, mohon tunggu...`);

        let hasilGabungan = "";
        for (const number of numbers) {
          const hasil = await Cekkuota(number);
          hasilGabungan += hasil + "\n\n";
        }

        try {
          // Coba edit pesan loading dengan hasil cek kuota
          await this.editMessageText(chatId, loadingMsg.result.message_id, hasilGabungan.trim(), { parse_mode: 'Markdown' });
        } catch {
          // Jika gagal edit pesan, kirim pesan baru
          await this.sendMessage(chatId, hasilGabungan.trim(), { parse_mode: 'Markdown' });
        }
      }

      this.waitingForNumbers.delete(chatId);
      return new Response('OK', { status: 200 });
    }

    // Kalau pesan adalah perintah /cekkuota
    if (text.startsWith('/cekkuota')) {
      await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):");
      this.waitingForNumbers.set(chatId, true);
      return new Response('OK', { status: 200 });
    }

    // Jika pesan lain, abaikan
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = { chat_id: chatId, message_id: messageId, text, ...options };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }
}
