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

      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }
  }

  formatQuotaResponse(number, data) {
    const info = data?.data?.data_sp;

    if (!data || !data.status || !info) {
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
        const paket = quotaGroup?.[0]?.packages || quotaGroup?.packages;
        if (!paket) return;

        msg += `\n🎁 Paket: ${paket.name || '-'}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(paket.expDate) || '-'}\n`;
        msg += `-----------------------------\n`;
      });
    } else {
      const hasilRaw = data?.data?.hasil || '';
      const hasilText = hasilRaw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      msg += hasilText ? `📦 Info Tambahan:\n${hasilText}\n` : `📦 Tidak ada detail paket kuota.`;
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
