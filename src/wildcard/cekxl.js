export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

// File: telegramCekkuota.js

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

    // Cari nomor HP (10–13 digit) di dalam teks
    const numbers = text.match(/\d{10,13}/g);
    if (!numbers) return;

    // Proses setiap nomor secara paralel
    const replies = await Promise.all(
      numbers.map((num) => this.checkOneNumber(num))
    );

    // Gabungkan balasan (dipisah satu baris kosong), lalu kirim sebagai satu pesan
    await this.sendMessage(chatId, replies.join('\n\n'), true);
  }

  // Mengecek satu nomor dan mengembalikan string hasilnya
  async checkOneNumber(num) {
    try {
      const res = await fetch(
        `https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${num}`
      );
      if (!res.ok) {
        // Kalau HTTP status bukan 200
        return `❌ Gagal cek kuota untuk ${num}`;
      }

      const data = await res.json();
      console.log(`🔍 Respond API untuk ${num}:`, JSON.stringify(data));

      // Coba ambil objek data_sp (bila tersedia)
      // Menurut contoh JSON yang kamu kirim:
      //   {
      //     "data": {
      //       "data_sp": { … },
      //       "hasil": "…",
      //       "msisdn": "087756116610"
      //     },
      //     "message": "SUCCESS",
      //     "status": true,
      //     "statusCode": 200
      //   }
      //
      // Jadi, path yang benar adalah data.data.data_sp
      const info = data?.data?.data_sp ?? null;

      // Ambil fallback HTML (jika quotas kosong/nol)
      const rawHasil = data?.data?.hasil ?? '';

      // Jika info masih null, kita tetap kirimkan balasan dengan teks fallback
      if (!info) {
        // Konversi HTML → teks agar gampang dibaca
        const teksSaja = rawHasil
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        return (
          `📱 Nomor: ${num}\n\n` +
          `❗ Info:\n${teksSaja || 'Tidak ada detail paket kuota.'}`
        );
      }

      // Kalau info ada, susun format lengkap
      return this.formatQuotaResponse(num, info, rawHasil);
    } catch (err) {
      console.error(`Error fetching kuota untuk ${num}:`, err);
      return `❌ Gagal cek kuota untuk ${num}`;
    }
  }

  /**
   * number   = string, misal "087756116610"
   * info     = objek data_sp (sesuai JSON)
   * rawHasil = string HTML fallback (jika quotas kosong)
   */
  formatQuotaResponse(number, info, rawHasil) {
    // Ambil properti-properti yang kita butuhkan (bila ada)
    const {
      prefix,        // { value: "XL" }
      active_card,   // { value: "5 Tahun 11 Bulan" }
      dukcapil,      // { value: "Sudah" }
      status_4g,     // { value: "4G" }
      active_period, // { value: "2025-06-25" }
      grace_period,  // { value: "2025-07-25" }
      quotas         // { value: [ [ { packages: {...}, benefits: [] } ], … ] }
    } = info;

    // Mulai membangun pesan
    let msg = `📱 Nomor: ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

    // Cek apakah ada detail paket kuota
    const arrQuota = quotas?.value;
    if (Array.isArray(arrQuota) && arrQuota.length > 0) {
      msg += `📦 Detail Paket Kuota:\n`;
      arrQuota.forEach((group) => {
        if (!Array.isArray(group) || group.length === 0) return;
        const pkg = group[0].packages;
        msg += `\n🎁 Paket: ${pkg?.name || '-'}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(pkg?.expDate)}\n`;
        msg += `-----------------------------\n`;
      });
      return msg.trim();
    }

    // Jika tidak ada arrQuota atau kosong, pakai rawHasil (HTML → teks)
    const teksSaja = rawHasil
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    msg += `❗ Info Tambahan:\n${teksSaja || 'Tidak ada detail paket kuota.'}`;
    return msg.trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const pad = (n) => (n < 10 ? '0' + n : n);
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: 'Markdown' } : {}),
    };

    try {
      await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}
