export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Ubah awalan "0" menjadi "62"
  normalizeNumber(number) {
    let num = number.trim();
    if (num.startsWith('0')) num = '62' + num.slice(1);
    return num;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';
    if (!chatId || !text) return;

    const numbers = text.match(/\d{10,13}/g);
    if (!numbers || numbers.length === 0) return;

    const replies = await Promise.all(numbers.map(async (orig) => {
      const msisdn = this.normalizeNumber(orig);
      try {
        const res = await fetch(
          `https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${msisdn}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
              'Accept': 'application/json',
              'Referer': 'https://dompul.free-accounts.workers.dev/',
              'Origin': 'https://dompul.free-accounts.workers.dev'
            }
          }
        );

        console.log(`📡 [${msisdn}] Status:`, res.status);
        const bodyText = await res.text();
        console.log(`🔍 [${msisdn}] Respons:\n`, bodyText);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = JSON.parse(bodyText);
        return this.formatQuotaResponse(msisdn, data);
      } catch (err) {
        console.error(`❌ Gagal cek kuota ${msisdn}:`, err);
        return `❌ Gagal cek kuota untuk ${msisdn}`;
      }
    }));

    await this.sendMessage(chatId, replies.join('\n\n'), true);
  }

  formatQuotaResponse(number, data) {
    if (!data?.status || !data.data?.data_sp) {
      return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
    }

    const info = data.data.data_sp;
    const {
      prefix, active_card, dukcapil,
      status_4g, active_period, grace_period, quotas
    } = info;

    let msg = `📱 *Nomor:* ${number}\n` +
              `• Tipe Kartu: ${prefix?.value || '-'}\n` +
              `• Umur Kartu: ${active_card?.value || '-'}\n` +
              `• Status Dukcapil: ${dukcapil?.value || '-'}\n` +
              `• Status 4G: ${status_4g?.value || '-'}\n` +
              `• Masa Aktif: ${active_period?.value || '-'}\n` +
              `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    if (quotas?.success && Array.isArray(quotas.value) && quotas.value.length) {
      msg += `📦 *Detail Paket Kuota:*\n`;
      quotas.value.forEach(group => {
        const pkg = group[0]?.packages;
        msg += `\n🎁 Paket: ${pkg?.name || '-'}\n` +
               `📅 Aktif Hingga: ${this.formatDate(pkg?.expDate)}\n` +
               `-----------------------------\n`;
      });
    } else {
      // Ambil teks dari data.hasil dan bersihkan tag HTML
      const raw = data.data.hasil || '';
      const clean = raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      msg += `❗ Info:\n${clean}`;
    }

    return msg.trim();
  }

  formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return [
      d.getFullYear(),
      this.pad(d.getMonth()+1),
      this.pad(d.getDate())
    ].join('-') + ' ' +
    [ this.pad(d.getHours()), this.pad(d.getMinutes()), this.pad(d.getSeconds()) ].join(':');
  }

  pad(n) { return n < 10 ? '0'+n : ''+n; }

  async sendMessage(chatId, text, markdown = false) {
    const payload = { chat_id: chatId, text };
    if (markdown) payload.parse_mode = 'Markdown';
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}
