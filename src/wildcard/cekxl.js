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

    const replies = await Promise.all(numbers.map((num) => this.checkOneNumber(num)));
    await this.sendMessage(chatId, replies.join('\n\n'), true);
  }

  async checkOneNumber(num) {
    try {
      const res = await fetch(
        `https://dompul.free-accounts.workers.dev/cek_kuota?msisdn=${num}`
      );
      if (!res.ok) {
        console.error(`HTTP ERROR ${res.status} untuk nomor ${num}`);
        return `❌ Gagal cek kuota untuk ${num}`;
      }

      const data = await res.json();
      // Cetak seluruh JSON yang diterima, supaya kita bisa cek struktur aslinya
      console.log(`🔍 RESPOND API UNTUK ${num}: ${JSON.stringify(data)}`);

      // Coba ambil data_sp di jalur yang paling umum
      // (→ sesuai contoh: data.data.data_sp)
      let info = data?.data?.data_sp ?? null;

      // Jika belum dapat, coba juga data.data_sp langsung
      if (!info && data?.data_sp) {
        info = data.data_sp;
      }

      // Ambil fallback HTML/teks dari field 'hasil' (bila ada)
      let rawHasil = data?.data?.hasil ?? '';
      if (!rawHasil && data?.hasil) {
        rawHasil = data.hasil;
      }

      // Kalau info masih null, return seluruh JSON sebagai teks
      if (!info) {
        const teksJSON = JSON.stringify(data, null, 2)
          .replace(/\\n/g, '\n')
          .trim();
        return (
          `📱 Nomor: ${num}\n\n` +
          `⚠️ field data_sp tidak ditemukan.\n` +
          `Ini JSON lengkapnya:\n\n` +
          '```\n' +
          teksJSON +
          '\n```'
        );
      }

      // Kalau info ada, susun respons normal
      return this.formatQuotaResponse(num, info, rawHasil);
    } catch (err) {
      console.error(`ERROR FETCH untuk ${num}:`, err);
      return `❌ Gagal cek kuota untuk ${num}`;
    }
  }

  formatQuotaResponse(number, info, rawHasil) {
    // Ambil properti-properti yang kita butuhkan (jika ada)
    const {
      prefix,        // { value: "XL" } misalnya
      active_card,   // { value: "5 Tahun 11 Bulan" }
      dukcapil,      // { value: "Sudah" }
      status_4g,     // { value: "4G" }
      active_period, // { value: "2025-06-25" }
      grace_period,  // { value: "2025-07-25" }
      quotas         // { value: [ [ { packages: {...}, benefits: [...] } ], ... ] }
    } = info;

    let msg = `📱 Nomor: ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || '-'}\n`;
    msg += `• Umur Kartu: ${active_card?.value || '-'}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || '-'}\n`;
    msg += `• Status 4G: ${status_4g?.value || '-'}\n`;
    msg += `• Masa Aktif: ${active_period?.value || '-'}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || '-'}\n\n`;

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

    // Jika tidak ada arrQuota, tampilkan rawHasil (HTML → teks) atau pesan default
    const teksSaja = (rawHasil || '')
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
