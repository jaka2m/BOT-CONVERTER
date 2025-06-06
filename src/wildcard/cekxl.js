// File: telegramCekkuota.js

export class TelegramCekkuota {
  constructor(token, apiUrlBase = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrlBase = apiUrlBase;
  }

  /**
   * Panggil ketika ada update dari Telegram (misal via webhook).
   * @param {object} update — objek update Telegram
   */
  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';
    if (!chatId || !text) return;

    // Cari nomor HP 10–13 digit dalam teks
    const numbers = text.match(/\d{10,13}/g);
    if (!numbers || numbers.length === 0) return;

    // Proses setiap nomor secara paralel
    const replies = await Promise.all(
      numbers.map((num) => this.checkOneNumber(num))
    );

    // Gabungkan balasan, pisahkan dengan satu baris kosong
    const finalText = replies.join('\n\n');
    await this.sendMessage(chatId, finalText, true);
  }

  /**
   * Cek kuota satu nomor, kembalikan string hasilnya.
   * @param {string} msisdn — nomor HP, misal "087756116610"
   * @returns {Promise<string>}
   */
  async checkOneNumber(msisdn) {
    // Bentuk URL dengan query string isJSON=true
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;

    // Header sesuai contoh
    const headers = {
      Authorization: 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
      'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
      'X-App-Version': '4.0.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    };

    try {
      const apiResponse = await fetch(apiUrl, { headers });
      if (!apiResponse.ok) {
        // Bila HTTP status bukan 200, ambil error JSON (jika ada) untuk debug
        let debugData = {};
        try {
          debugData = await apiResponse.json();
        } catch {
          debugData = { message: 'Tidak dapat mengurai respons error.' };
        }
        console.error(
          `HTTP ${apiResponse.status} saat cek kuota untuk ${msisdn}:`,
          debugData
        );

        return `❌ Gagal cek kuota untuk ${msisdn}`;
      }

      const data = await apiResponse.json();
      console.log(`🔍 Respons API untuk ${msisdn}:`, JSON.stringify(data));

      // Dari contoh JSON:
      // {
      //   "status": true,
      //   "message": "SUCCESS",
      //   "statusCode": 200,
      //   "data": {
      //     "data_sp": { … },
      //     "hasil": "…",
      //     "msisdn": "087756116610"
      //   }
      // }
      //
      // Jadi path yang benar adalah data.data.data_sp
      const info = data?.data?.data_sp ?? null;
      const rawHasil = data?.data?.hasil ?? '';

      if (!info) {
        // Kalau data_sp tidak ditemukan, kirim fallback menggunakan rawHasil
        const teksSaja = rawHasil
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        return (
          `📱 Nomor: ${msisdn}\n\n` +
          `❗ Info:\n${teksSaja || 'Tidak ada detail paket kuota.'}`
        );
      }

      // Bila info tersedia, format lengkap
      return this.formatQuotaResponse(msisdn, info, rawHasil);
    } catch (err) {
      console.error(`ERROR fetch untuk ${msisdn}:`, err);
      return `❌ Gagal cek kuota untuk ${msisdn}`;
    }
  }

  /**
   * Format pesan kuota ketika data_sp ada.
   * @param {string} number — nomor HP
   * @param {object} info — objek data_sp
   * @param {string} rawHasil — fallback HTML (hasil)
   * @returns {string}
   */
  formatQuotaResponse(number, info, rawHasil) {
    // Ambil fields yang diperlukan (value: ...)
    const {
      prefix,
      active_card,
      dukcapil,
      status_4g,
      active_period,
      grace_period,
      quotas,
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

    // Jika quotas kosong atau tidak ada, tampilkan rawHasil (HTML → teks)
    const teksSaja = rawHasil
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    msg += `❗ Info Tambahan:\n${teksSaja || 'Tidak ada detail paket kuota.'}`;
    return msg.trim();
  }

  /**
   * Format ISO date string ke "YYYY-MM-DD hh:mm:ss".
   * @param {string} dateStr — misal "2025-06-11T23:59:59"
   * @returns {string}
   */
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

  /**
   * Kirim pesan balasan ke chatId tertentu.
   * @param {number|string} chatId
   * @param {string} text — pesan (Markdown-enabled jika markdown=true)
   * @param {boolean} markdown — set true agar parse_mode="Markdown"
   */
  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: 'Markdown' } : {}),
    };
    try {
      await fetch(`${this.apiUrlBase}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}
