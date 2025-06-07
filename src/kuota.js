// cekkuota.js

/**
 * Fungsi ini tidak digunakan dalam kelas CekkuotaBotku, jadi sebaiknya dihapus
 * atau dipindahkan jika ada kegunaan terpisah. Untuk saat ini, saya akan menyimpannya
 * tetapi perhatikan bahwa ini mungkin tidak perlu.
 * @param {string} link - URL bot (saat ini hanya untuk logging).
 */
export async function cekkuota(link) {
  console.log("Bot link:", link);
}

/**
 * Kelas CekkuotaBotku untuk berinteraksi dengan API Telegram dan API Cek Kuota.
 */
export class CekkuotaBotku {
  /**
   * Konstruktor untuk CekkuotaBotku.
   * @param {string} token - Token bot Telegram Anda.
   * @param {string} [apiUrl='https://api.telegram.org'] - URL dasar API Telegram.
   */
  constructor(token, apiUrl = 'https://api.telegram.org') {
    if (!token) {
      throw new Error('Token bot Telegram harus disediakan.');
    }
    this.token = token;
    this.apiUrl = apiUrl;
    this.baseUrl = `${this.apiUrl}/bot${this.token}`;
  }

  /**
   * Utility: Meng-escape karakter HTML untuk mencegah kesalahan parsing di Telegram.
   * @param {string} str - String yang akan di-escape.
   * @returns {string} String yang sudah di-escape.
   */
  static escapeHTML(str) {
    if (typeof str !== 'string') return str; // Pastikan input adalah string
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Utility: Memformat objek Date atau string tanggal ke format 'YYYY-MM-DD HH:mm:ss' atau 'YYYY-MM-DD'.
   * @param {(Date|string)} dateInput - Objek Date atau string tanggal.
   * @param {'full'|'dateOnly'} [type='full'] - Tipe format output. 'full' untuk tanggal dan waktu, 'dateOnly' untuk tanggal saja.
   * @returns {string} Tanggal yang diformat atau '-' jika input tidak valid.
   */
  static formatDate(dateInput, type = 'full') {
    if (!dateInput) return '-';

    let d;
    // Handle Date object
    if (dateInput instanceof Date) {
      d = dateInput;
    }
    // Handle string inputs
    else if (typeof dateInput === 'string') {
      // If already in 'YYYY-MM-DD HH:mm:ss' format
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
        return type === 'dateOnly' ? dateInput.slice(0, 10) : dateInput;
      }
      // If already in 'YYYY-MM-DD' format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return type === 'dateOnly' ? dateInput : `${dateInput} 00:00:00`;
      }
      // Try parsing as a Date object
      d = new Date(dateInput);
    } else {
      return '-'; // Return '-' for unsupported types
    }

    // Check for invalid Date
    if (isNaN(d.getTime())) return '-';

    const pad = n => n < 10 ? '0' + n : n;
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());

    if (type === 'dateOnly') {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  /**
   * Mengirim chat action (misalnya, 'typing', 'upload_photo') ke obrolan.
   * @param {number} chatId - ID obrolan target.
   * @param {string} action - Tipe aksi chat.
   */
  async sendChatAction(chatId, action) {
    const url = `${this.baseUrl}/sendChatAction`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (err) {
      console.error(`[ERROR] Gagal mengirim chat action ke ${chatId}:`, err);
    }
  }

  /**
   * Menghapus pesan dari obrolan.
   * @param {number} chatId - ID obrolan tempat pesan berada.
   * @param {number} messageId - ID pesan yang akan dihapus.
   */
  async deleteMessage(chatId, messageId) {
    const url = `${this.baseUrl}/deleteMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
    } catch (err) {
      console.error(`[ERROR] Gagal menghapus pesan ${messageId} di ${chatId}:`, err);
    }
  }

  /**
   * Mengirim pesan teks ke obrolan.
   * @param {number} chatId - ID obrolan target.
   * @param {string} text - Teks pesan.
   * @param {object} [options={}] - Opsi tambahan untuk permintaan sendMessage (misalnya, parse_mode, reply_markup).
   * @returns {Promise<object|null>} Objek respons JSON dari Telegram atau null jika terjadi kesalahan.
   */
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.baseUrl}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error(`[ERROR] Gagal mengirim pesan ke ${chatId}: HTTP ${res.status}, Deskripsi: ${errorData.description || 'Tidak ada deskripsi.'}`);
        return null;
      }
      return res.json();
    } catch (err) {
      console.error(`[ERROR] Gagal mengirim pesan ke ${chatId}:`, err);
      return null;
    }
  }

  /**
   * Mengedit pesan teks yang sudah ada di obrolan.
   * @param {number} chatId - ID obrolan tempat pesan berada.
   * @param {number} messageId - ID pesan yang akan diedit.
   * @param {string} text - Teks baru untuk pesan.
   * @param {object} [options={}] - Opsi tambahan untuk permintaan editMessageText.
   */
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.baseUrl}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error(`[ERROR] Gagal mengedit pesan ${messageId} di ${chatId}: HTTP ${res.status}, Deskripsi: ${errorData.description || 'Tidak ada deskripsi.'}`);
      }
    } catch (err) {
      console.error(`[ERROR] Gagal mengedit pesan ${messageId} di ${chatId}:`, err);
    }
  }

  /**
   * Mengambil data kuota dari API eksternal.
   * @param {string} msisdn - Nomor telepon (MSISDN) yang akan dicek kuotanya.
   * @returns {Promise<object>} Objek respons JSON dari API cek kuota.
   * @throws {Error} Jika respons HTTP tidak OK.
   */
  async checkQuota(msisdn) {
    // Memastikan msisdn diformat dengan benar jika diperlukan oleh API (misalnya, menambahkan '62')
    const formattedMsisdn = msisdn.startsWith('08') ? `62${msisdn.substring(1)}` : msisdn;
    const url = `https://api.geoproject.biz.id/cek_kuota?msisdn=${formattedMsisdn}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[API Error] HTTP error! status: ${res.status} for MSISDN: ${msisdn}`);
    }
    return res.json();
  }

  /**
   * Handler utama untuk setiap update dari Telegram.
   * Memproses pesan masuk dan merespons dengan informasi kuota.
   * @param {object} update - Objek update dari Telegram API.
   */
  async handleUpdate(update) {
    const msg = update.message;
    const chatId = msg?.chat?.id;
    const messageId = msg?.message_id;
    const text = msg?.text?.trim() || '';
    const from = msg?.from || {};
    const username = from.username || from.first_name || 'N/A';
    const userId = from.id || 'N/A';

    // Abaikan update jika tidak ada chatId atau teks pesan
    if (!chatId || !text) return;

    // Handle perintah /help
    if (text.startsWith('/help')) {
      const helpText = `
<b>Bantuan Bot Cek Kuota</b>

• Kirim nomor HP untuk cek kuota.
• Format: <code>08xxxxxx</code> atau <code>628xxxxxx</code>.
• Anda bisa mengirim beberapa nomor sekaligus, dipisahkan dengan spasi.
• Contoh: <code>085666372626 6285647728247</code>
      `;
      return this.sendMessage(chatId, helpText, { parse_mode: "HTML" });
    }

    // Pecah input menjadi array nomor HP valid
    // Menambahkan validasi untuk memastikan nomor dimulai dengan '08' atau '628' dan memiliki panjang yang sesuai.
    const phoneNumbers = text
      .split(/\s+/)
      .filter(num => (num.startsWith('08') && num.length >= 10 && num.length <= 14) || (num.startsWith('628') && num.length >= 11 && num.length <= 15));

    if (phoneNumbers.length === 0) {
      // Jika tidak ada nomor telepon yang valid, bisa memilih untuk tidak merespons
      // atau memberikan pesan kesalahan. Untuk saat ini, kita tidak merespons.
      return;
    }

    // Kirim pesan "loading" awal dan simpan ID-nya
    const loadingMessageText = `⌛ Sedang memproses ${phoneNumbers.length > 1 ? 'nomor-nomor' : 'nomor'}...`;
    const loadingMessageResponse = await this.sendMessage(chatId, loadingMessageText);
    const loadingMessageId = loadingMessageResponse?.result?.message_id;

    // Tampilkan indikator mengetik
    await this.sendChatAction(chatId, 'typing');

    const allResponses = [];
    const now = new Date();
    const checkTime = CekkuotaBotku.formatDate(now, 'full');

    for (const number of phoneNumbers) {
      const parts = [];
      const sep = '============================';

      // Header info user (opsional, bisa dipindahkan ke luar loop jika hanya ingin satu kali)
      // Saya biarkan di dalam loop untuk setiap nomor, tapi bisa dipertimbangkan untuk satu kali di atas.
      parts.push(`🥷 <b>User</b>: ${CekkuotaBotku.escapeHTML(username)}`);
      parts.push(`🆔 <b>User ID</b>: ${CekkuotaBotku.escapeHTML(String(userId))}`);
      parts.push(`📆 <b>Waktu Pengecekan</b>: ${CekkuotaBotku.escapeHTML(checkTime)}`);
      parts.push('══════════════════════');

      try {
        const apiRes = await this.checkQuota(number);

        if (apiRes?.status === 'success' && apiRes.data?.data) {
          const info = apiRes.data.data;
          const sp = info.data_sp; // Data spesifik penyedia
          const {
            quotas, status_4g, dukcapil,
            grace_period, active_period,
            active_card, prefix
          } = sp || {}; // Tambahkan default kosong jika sp tidak ada

          // Detail kartu
          parts.push(`☎️ <b>Nomor</b>: ${CekkuotaBotku.escapeHTML(info.msisdn || '-')}`);
          parts.push(`📡 <b>Tipe Kartu</b>: ${CekkuotaBotku.escapeHTML(prefix?.value || '-')}`);
          parts.push(`📶 <b>Status Kartu</b>: ${CekkuotaBotku.escapeHTML(status_4g?.value || '-')}`);
          parts.push(`🪪 <b>Status Dukcapil</b>: ${CekkuotaBotku.escapeHTML(dukcapil?.value || '-')}`);
          parts.push(`🗓️ <b>Umur Kartu</b>: ${CekkuotaBotku.escapeHTML(active_card?.value || '-')}`);
          parts.push(`🚓 <b>Masa Aktif</b>: ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(active_period?.value, 'dateOnly'))}`);
          parts.push(`🆘 <b>Masa Tenggang</b>: ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(grace_period?.value, 'dateOnly'))}`);

          // Kuota
          if (Array.isArray(quotas?.value) && quotas.value.length) {
            quotas.value.forEach(group => {
              // Pastikan group adalah array dan memiliki setidaknya satu elemen
              if (!Array.isArray(group) || group.length === 0) return;

              const pkg = group[0].packages;
              parts.push(sep);
              parts.push(`📦 <b>${CekkuotaBotku.escapeHTML(pkg?.name || 'Paket Tidak Diketahui')}</b>`);
              parts.push(`⏰ <b>Aktif Hingga</b>: ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(pkg?.expDate, 'full'))}`);

              // Pastikan benefits adalah array sebelum iterasi
              if (Array.isArray(group[0].benefits)) {
                group[0].benefits.forEach(b => {
                  parts.push(`  🌀 <b>Benefit</b>: ${CekkuotaBotku.escapeHTML(b.bname || '-')}`);
                  parts.push(`  🧢 <b>Tipe Kuota</b>: ${CekkuotaBotku.escapeHTML(b.type || '-')}`);
                  parts.push(`  🎁 <b>Kuota</b>: ${CekkuotaBotku.escapeHTML(b.quota || '-')}`);
                  parts.push(`  ⏳ <b>Sisa</b>: ${CekkuotaBotku.escapeHTML(b.remaining || '-')}`);
                });
              } else {
                parts.push('  <i>Tidak ada detail benefit kuota.</i>');
              }
            });
          } else {
            parts.push(sep);
            parts.push('<i>Tidak ada informasi kuota yang tersedia.</i>');
          }
        } else {
          // Status bukan success atau data tidak lengkap
          parts.push(`☎️ <b>Nomor</b>: ${CekkuotaBotku.escapeHTML(number)}`);
          parts.push(sep);
          parts.push(`❗ <b>Info</b>: Maaf, tidak dapat mengambil data kuota untuk nomor ini atau data tidak lengkap.`);
          if (apiRes?.message) {
            parts.push(`Detail: ${CekkuotaBotku.escapeHTML(apiRes.message)}`);
          }
        }

      } catch (err) {
        console.error(`[ERROR] Terjadi kesalahan saat cek kuota untuk ${number}:`, err);
        parts.push(`☎️ <b>Nomor</b>: ${CekkuotaBotku.escapeHTML(number)}`);
        parts.push(sep);
        parts.push(`❗ <b>Info</b>: Terjadi kesalahan internal saat memproses nomor ini. Silakan coba lagi nanti.`);
      }

      // Gunakan <pre> atau <code> jika ingin menjaga format spasi dan baris baru lebih ketat
      // Menggunakan <blockquote> dan <pre> atau <code> di dalamnya bisa memberikan hasil yang rapi.
      allResponses.push(`<blockquote><pre>${parts.join('\n')}</pre></blockquote>`);
    }

    // Hapus pesan loading setelah semua proses selesai
    if (loadingMessageId) {
      await this.deleteMessage(chatId, loadingMessageId);
    }

    // Kirim balasan gabungan dengan hasil akhir
    // Batasi panjang pesan jika terlalu panjang (Telegram memiliki batasan 4096 karakter)
    const finalResponse = allResponses.join('\n\n');
    if (finalResponse.length > 4096) {
      await this.sendMessage(chatId, `Hasil terlalu panjang. Hanya menampilkan sebagian:\n\n${finalResponse.substring(0, 4000)}...`, { parse_mode: 'HTML' });
    } else {
      await this.sendMessage(chatId, finalResponse, { parse_mode: 'HTML' });
    }

    // (Opsional) hapus pesan user
    // Hati-hati dengan ini, karena user mungkin ingin melihat input mereka.
    // Jika diaktifkan, pastikan pengguna tahu pesannya akan dihapus.
    // if (messageId) {
    //   await this.deleteMessage(chatId, messageId);
    // }
  }
}
