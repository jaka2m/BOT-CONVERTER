// File: telegramCekkuota.js

// Export fungsi sederhana (sesuai permintaan Anda)
export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // -----------------------------
  // Metode untuk mengecek kuota
  // -----------------------------
  async cekKuota(msisdn) {
    const url = `https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${msisdn}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const dataSp = data?.data?.data_sp;

      if (!dataSp) {
        return `❌ Gagal mendapatkan data untuk *${msisdn}*.`;
      }

      let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${msisdn}
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

    } catch (err) {
      console.error('❌ Error saat cekKuota:', err);
      return `❌ Terjadi kesalahan: ${err.message}`;
    }
  }

  // -----------------------------------
  // Metode untuk mengirim pesan Telegram
  // -----------------------------------
  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {})
    };

    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }

  // ---------------------------------------------
  // Metode untuk menangani update dari webhook
  // ---------------------------------------------
  async handleUpdate(update) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Cek perintah /cekkuota
    if (text.startsWith('/cekkuota')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this.sendMessage(
          chatId,
          '❗ Format salah. Contoh penggunaan:\n`/cekkuota 081234567890`',
          true
        );
        return;
      }

      const msisdn = parts[1].trim();
      await this.sendMessage(chatId, `⏳ Sedang mengecek kuota untuk: ${msisdn}...`);
      const result = await this.cekKuota(msisdn);
      await this.sendMessage(chatId, result, true);
    } else {
      await this.sendMessage(
        chatId,
        '🤖 Perintah tidak dikenali. Gunakan /cekkuota <nomor>',
        true
      );
    }
  }
}
