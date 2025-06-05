export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!chatId || !text) return;

    // Cari semua nomor HP 10–13 digit dalam pesan
    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      const replies = await Promise.all(numbers.map(async (num) => {
        // Pastikan nomor format internasional (ganti 0 diawal dengan 62)
        const normalizedNum = num.startsWith('0') ? '62' + num.slice(1) : num;

        try {
          const res = await fetch(`https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${normalizedNum}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                            '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });

          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

          const data = await res.json();
          return this.formatQuotaResponse(normalizedNum, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${normalizedNum}:`, err);
          return `❌ Gagal cek kuota untuk ${normalizedNum}`;
        }
      }));

      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }

    // Jika tidak ada nomor valid, tidak merespon
  }

  formatQuotaResponse(number, data) {
    if (!data || !data.status || !data.data) {
      return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
    }

    const info = data.data.data_sp;

    if (!info) {
      return `⚠️ Data detail untuk nomor ${number} tidak tersedia.`;
    }

    const {
      prefix,
      dukcapil,
      status_4g,
      active_card,
      active_period,
      grace_period,
      quotas
    } = info;

    let msg = `📱 *Nomor:* ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    if (quotas?.success && Array.isArray(quotas.value) && quotas.value.length > 0) {
      msg += `📦 *Detail Paket Kuota:*\n`;
      quotas.value.forEach((quotaGroup) => {
        if (!quotaGroup || quotaGroup.length === 0) return;

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
      // Jika paket kosong, ambil hasil teks dari 'hasil' dan bersihkan tag HTML
      const hasilRaw = data.data.hasil || '';
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
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ` +
           `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
  }

  pad(n) {
    return n < 10 ? '0' + n : n;
  }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {})
    };

    try {
      await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}
