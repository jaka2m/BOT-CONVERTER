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
          const res = await fetch(`https://cors.geo-project.workers.dev/?url=https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${num}`);
          const data = await res.json();
          return this.formatQuotaResponse(num, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${num}:`, err);
          return `❌ Gagal cek kuota untuk ${num}`;
        }
      }));

      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }

    // Jika tidak ada nomor valid, tidak mengirim apapun (tidak merespon)
  }

  formatQuotaResponse(number, data) {
    const info = data?.data?.data_sp;
    const hasilRaw = data?.data?.hasil || '';

    if (!data?.status || !info) {
      return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
    }

    let msg = `📱 *Nomor:* ${number}\n`;
    msg += `• Tipe Kartu: ${info.prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${info.active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${info.dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${info.status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${info.active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${info.grace_period?.value || '-'}\n\n`;

    if (!Array.isArray(info.quotas?.value) || info.quotas.value.length === 0) {
      const hasilText = hasilRaw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      msg += `❗ Info Tambahan:\n${hasilText}`;
    }

    return msg.trim();
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
