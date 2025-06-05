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
        try {
          const res = await fetch(`https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${num}`);
          const data = await res.json();
          return this.formatQuotaResponse(num, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${num}:`, err);
          return `❌ Gagal cek kuota untuk ${num}`;
        }
      }));

      // Gabungkan balasan untuk tiap nomor, pisahkan dengan baris kosong
      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }
  }

  formatQuotaResponse(number, data) {
    const info = data?.data?.data_sp;

    // Pengecekan lebih longgar: hanya pastikan status true dan info objek ada
    if (!data?.status || !info || typeof info !== 'object') {
      return `❌ Gagal cek kuota untuk ${number}`;
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

    let msg = `📱 Nomor: ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
      msg += `📦 Detail Paket Kuota:\n`;

      quotas.value.forEach((quotaGroup) => {
        if (!quotaGroup || quotaGroup.length === 0) return;
        const packageInfo = quotaGroup[0].packages;
        msg += `\n🎁 Paket: ${packageInfo?.name || '-'}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(packageInfo?.expDate) || '-'}\n`;
        msg += `-----------------------------\n`;
      });
    } else {
      // Fallback ke hasil HTML bila quotas kosong
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
    const pad = n => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
         + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
