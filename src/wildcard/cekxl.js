export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = `${apiUrl}/bot${token}`;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!chatId || !text) return;

    if (text.startsWith('/start')) {
      return this.sendMessage(chatId, `
👋 Halo! Selamat datang di *Bot Sidompul Regar Store*.

Kirim nomor HP kamu dan pisahkan dengan spasi (misalnya: 087834567890 087865567890) untuk cek informasi kuota.

Bot ini akan membalas otomatis dengan detail kuota Anda. 📶
`, true);
    }

    if (text.startsWith('/help')) {
      return this.sendMessage(chatId, `
ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisahkan dengan spasi.  
• Contoh: 082112345678 085612345678

Bot akan menampilkan informasi kuota dengan cepat dan mudah dibaca.
`, true);
    }

    if (text.startsWith('/owner')) {
      return this.sendMessage(chatId, `👑 *Owner Bot*: ${process.env.OWNER_USERNAME || 'Belum diset'}`, true);
    }

    // Ambil semua nomor HP
    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      const replies = await Promise.all(numbers.map(async (num) => {
        try {
          const res = await fetch(`https://jav.zerostore.web.id/cek_kuota?msisdn=${num}`);
          const data = await res.json();
          return this.formatQuotaResponse(num, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${num}:`, err);
          return `❌ Gagal cek kuota untuk ${num}`;
        }
      }));

      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }

      }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {})
    };

    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }

  formatQuotaResponse(number, data) {
    const info = data?.data?.data_sp;

    if (!data || !data.status || !info) {
      return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
    }

    const {
      quotas,
      status_4g,
      dukcapil,
      grace_period,
      active_period,
      active_card,
      prefix
    } = info;

    let msg = `📱 *Nomor:* ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
      msg += `📦 *Detail Paket Kuota:*\n`;
      quotas.value.forEach((quotaGroup) => {
        if (quotaGroup.length === 0) return;
        const packageInfo = quotaGroup[0].packages;
        msg += `\n🎁 Paket: ${packageInfo?.name || '-'}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(packageInfo?.expDate) || '-'}\n`;

        if (quotaGroup[0].benefits && quotaGroup[0].benefits.length > 0) {
          quotaGroup[0].benefits.forEach(benefit => {
            msg += `• Benefit: ${benefit.bname}\n`;
            msg += `  Tipe Kuota: ${benefit.type}\n`;
            msg += `  Kuota: ${benefit.quota}\n`;
            msg += `  Sisa Kuota: ${benefit.remaining}\n`;
          });
        }
        msg += `-----------------------------\n`;
      });
    } else {
      const hasilRaw = data?.data?.hasil || '';
      const hasilText = hasilRaw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      msg += `❗ Info:\n${hasilText}\n`;
    }

    return msg.trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
  }

  pad(n) {
    return n < 10 ? '0' + n : n;
  }
}
