export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.baseUrl = `${this.apiUrl}/bot${this.token}`;
  }

  // Utility: escape HTML untuk mencegah parsing error di Telegram
  static escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Utility: format tanggal ke 'YYYY-MM-DD HH:mm:ss' atau 'YYYY-MM-DD'
  static formatDate(dateInput, type = 'full') {
    if (!dateInput) return '-';

    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string') {
      // Jika sudah dalam format yang diinginkan, langsung kembalikan
      if (type === 'dateOnly' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }
      if (type === 'full' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
        return dateInput;
      }
      d = new Date(dateInput);
    } else {
      return dateInput; // Kembalikan nilai asli jika tipe tidak didukung
    }

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

  // Kirim chat action (typing, upload_photo, dll.)
  async sendChatAction(chatId, action) {
    const url = `${this.baseUrl}/sendChatAction`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (err) {
      console.error(`[ERROR] Gagal mengirim chat action ke ${chatId}:`, err.message);
    }
  }

  // Hapus pesan
  async deleteMessage(chatId, messageId) {
    const url = `${this.baseUrl}/deleteMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
    } catch (err) {
      console.error(`[ERROR] Gagal menghapus pesan ${messageId} di ${chatId}:`, err.message);
    }
  }

  // Kirim pesan (teks, parse_mode opsional)
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
        throw new Error(`Telegram API error: ${errorData.description || res.statusText}`);
      }
      return res.json(); // Mengembalikan JSON response dari Telegram API
    } catch (err) {
      console.error(`[ERROR] Gagal mengirim pesan ke ${chatId}:`, err.message);
      return null;
    }
  }

  // Edit pesan yang sudah ada
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
        throw new Error(`Telegram API error: ${errorData.description || res.statusText}`);
      }
      return res.json();
    } catch (err) {
      console.error(`[ERROR] Gagal mengedit pesan ${messageId} di ${chatId}:`, err.message);
      return null;
    }
  }

  // Panggilan API cek kuota ke eksternal
  async checkQuota(msisdn) {
    const url = `https://api.geoproject.biz.id/cek_kuota?msisdn=${msisdn}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`[API Error] HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(`[API Error] ${data.message || 'Status API bukan success'}`);
      }
      return data;
    } catch (err) {
      console.error(`[ERROR] Gagal cek kuota untuk ${msisdn}:`, err.message);
      throw err; // Lempar kembali error untuk ditangani di handleUpdate
    }
  }

  // Membangun teks respons untuk satu nomor telepon
  _buildQuotaResponseText(phoneNumber, apiResponse, username, userId, checkTime) {
    const parts = [];
    const sep = '============================';

    // Header info user
    parts.push(`🥷 <b>User</b> : ${CekkuotaBotku.escapeHTML(username)}`);
    parts.push(`🆔 <b>User ID</b> : ${CekkuotaBotku.escapeHTML(String(userId))}`);
    parts.push(`📆 <b>Waktu Pengecekan</b> : ${CekkuotaBotku.escapeHTML(checkTime)}`);
    parts.push('══════════════════════');

    try {
      if (apiResponse?.status === 'success' && apiResponse.data?.data) {
        const info = apiResponse.data.data;
        const sp = info.data_sp;
        const {
          quotas, status_4g, dukcapil,
          grace_period, active_period,
          active_card, prefix
        } = sp;

        // Detail kartu
        parts.push(`☎️ <b>Nomor</b> : ${CekkuotaBotku.escapeHTML(info.msisdn || '-')}`);
        parts.push(`📡 <b>Tipe Kartu</b> : ${CekkuotaBotku.escapeHTML(prefix?.value || '-')}`);
        parts.push(`📶 <b>Status Kartu</b> : ${CekkuotaBotku.escapeHTML(status_4g?.value || '-')}`);
        parts.push(`🪪 <b>Status Dukcapil</b> : ${CekkuotaBotku.escapeHTML(dukcapil?.value || '-')}`);
        parts.push(`🗓️ <b>Umur Kartu</b> : ${CekkuotaBotku.escapeHTML(active_card?.value || '-')}`);
        parts.push(`🚓 <b>Masa Aktif</b> : ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(active_period?.value, 'dateOnly'))}`);
        parts.push(`🆘 <b>Masa Tenggang</b> : ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(grace_period?.value, 'dateOnly'))}`);

        // Kuota
        if (Array.isArray(quotas?.value) && quotas.value.length) {
          quotas.value.forEach(group => {
            if (!group.length) return;
            const pkg = group[0].packages;
            parts.push(sep);
            parts.push(`📦 <b>${CekkuotaBotku.escapeHTML(pkg?.name || 'Paket tidak dikenal')}</b>`);
            parts.push(`⏰ <b>Aktif Hingga</b> : ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(pkg?.expDate, 'full'))}`);
            group[0].benefits?.forEach(b => {
              parts.push(`  🌀 <b>Benefit</b> : ${CekkuotaBotku.escapeHTML(b.bname || '-')}`);
              parts.push(`  🧢 <b>Tipe Kuota</b>: ${CekkuotaBotku.escapeHTML(b.type || '-')}`);
              parts.push(`  🎁 <b>Kuota</b> : ${CekkuotaBotku.escapeHTML(b.quota || '-')}`);
              parts.push(`  ⏳ <b>Sisa</b> : ${CekkuotaBotku.escapeHTML(b.remaining || '-')}`);
            });
          });
        } else {
          parts.push(sep);
          parts.push(`❗ <b>Info</b>: Tidak ada data kuota ditemukan untuk nomor ini.`);
        }
      } else {
        // Status bukan success atau data tidak lengkap
        parts.push(`☎️ <b>Nomor</b> : ${CekkuotaBotku.escapeHTML(phoneNumber)}`);
        parts.push(sep);
        parts.push(`❗ <b>Info</b>: Maaf, tidak dapat mengambil data kuota untuk nomor ini atau data tidak lengkap.`);
      }
    } catch (err) {
      console.error(`[ERROR] Gagal membangun respons untuk ${phoneNumber}:`, err.message);
      parts.push(`☎️ <b>Nomor</b> : ${CekkuotaBotku.escapeHTML(phoneNumber)}`);
      parts.push(sep);
      parts.push(`❗ <b>Info</b>: Terjadi kesalahan saat memproses data untuk nomor ini.`);
    }

    return `<blockquote>${parts.join('\n')}</blockquote>`;
  }

  // Main handler untuk setiap update yang diterima dari Telegram
  async handleUpdate(update) {
    const msg = update.message;
    const chatId = msg?.chat?.id;
    const messageId = msg?.message_id;
    const text = msg?.text?.trim() || '';
    const from = msg?.from || {};
    const username = from.username || from.first_name || 'N/A';
    const userId = from.id || 'N/A';

    // Abaikan update jika tidak ada chat ID atau teks pesan
    if (!chatId || !text) return;

    // Tangani perintah /help
    if (text.startsWith('/help')) {
      const helpText = `
<b>Bantuan Bot Cek Kuota</b>

• Kirim nomor HP untuk cek kuota.
• Format: <code>08xxxxxx</code> atau <code>628xxxxxx</code>.
• Anda bisa mengirim beberapa nomor sekaligus, pisahkan dengan spasi.
• Contoh: <code>081234567890 628987654321</code>
      `;
      return this.sendMessage(chatId, helpText, { parse_mode: "HTML" });
    }

    // Ekstrak nomor HP yang valid dari pesan
    const phoneNumbers = text
      .split(/\s+/)
      .filter(num => (num.startsWith('08') || num.startsWith('628')) && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length === 0) {
      // Jika tidak ada nomor HP valid, tidak perlu melakukan apa-apa atau bisa kirim pesan info
      return; // Atau kirim this.sendMessage(chatId, "Mohon masukkan nomor HP yang valid.");
    }

    // Kirim pesan "loading" awal dan simpan ID-nya untuk diedit/dihapus nanti
    const loadingMessageText = `⌛ Sedang memproses ${phoneNumbers.length > 1 ? 'nomor-nomor' : 'nomor'} yang Anda berikan...`;
    const loadingMessageResponse = await this.sendMessage(chatId, loadingMessageText);
    const loadingMessageId = loadingMessageResponse?.result?.message_id;

    // Tampilkan indikator mengetik
    await this.sendChatAction(chatId, 'typing');

    const allResponses = [];
    const now = new Date();
    const checkTime = CekkuotaBotku.formatDate(now, 'full');

    for (const number of phoneNumbers) {
      try {
        const apiRes = await this.checkQuota(number);
        allResponses.push(this._buildQuotaResponseText(number, apiRes, username, userId, checkTime));
      } catch (err) {
        // Tangani error dari checkQuota
        allResponses.push(this._buildQuotaResponseText(number, { status: 'error', message: err.message }, username, userId, checkTime));
      }
    }

    // Hapus pesan loading setelah semua proses selesai
    if (loadingMessageId) {
      await this.deleteMessage(chatId, loadingMessageId);
    }

    // Kirim balasan gabungan dengan hasil akhir
    await this.sendMessage(chatId, allResponses.join('\n\n'), { parse_mode: 'HTML' });

    // (Opsional) hapus pesan asli dari user
    if (messageId) {
      await this.deleteMessage(chatId, messageId);
    }
  }
}
