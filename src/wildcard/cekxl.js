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

    const numbers = text.match(/\d{10,13}/g);
    if (!numbers) return;

    const replies = await Promise.all(numbers.map(async num => {
      try {
        const res = await fetch(
          `https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${num}`
        );
        const data = await res.json();

        // ➤ Ambil info dari data.data_sp atau data.data.data_sp
        const info =
          data?.data?.data_sp   // sesuai dokumentasi baru
          || data?.data_sp      // fallback jika langsung
          || null;

        if (!info) {
          return `❌ Gagal cek kuota untuk ${num}`;
        }

        // rawHasil untuk fallback HTML bila kuota kosong
        const rawHasil = data?.data?.hasil
                     || data?.hasil
                     || '';

        return this.formatQuotaResponse(num, info, rawHasil);
      } catch (err) {
        console.error(`Error fetching kuota untuk ${num}:`, err);
        return `❌ Gagal cek kuota untuk ${num}`;
      }
    }));

    await this.sendMessage(chatId, replies.join('\n\n'), true);
  }

  /**
   * info     = objek data_sp
   * rawHasil = string HTML fallback (data.hasil atau data.data.hasil)
   */
  formatQuotaResponse(number, info, rawHasil) {
    const {
      prefix,           // { value: "XL" }
      active_card,      // { value: "5 Tahun 11 Bulan" }
      dukcapil,         // { value: "Sudah" }
      status_4g,        // { value: "4G" }
      active_period,    // { value: "2025-06-25" }
      grace_period,     // { value: "2025-07-25" }
      quotas            // { value: [ [ { packages: {...}, benefits: [] } ], ... ] }
    } = info;

    let msg = `📱 Nomor: ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    const arr = quotas?.value;
    if (Array.isArray(arr) && arr.length > 0) {
      msg += `📦 Detail Paket Kuota:\n`;
      arr.forEach(group => {
        if (!Array.isArray(group) || group.length === 0) return;
        const pkg = group[0].packages;
        msg += `\n🎁 Paket: ${pkg?.name || '-'}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(pkg.expDate)}\n`;
        msg += `-----------------------------\n`;
      });
    } else {
      // Fallback: konversi HTML ke teks
      const text = rawHasil
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      msg += `❗ Info Tambahan:\n${text}`;
    }

    return msg.trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const pad = n => n < 10 ? '0' + n : n;
    return (
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: 'Markdown' } : {})
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
