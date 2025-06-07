export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.apiUrl = `${this.apiUrl}/bot${this.token}`;
  }

  // Utility: escape HTML untuk mencegah parsing error
  static escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Utility: format tanggal
  static formatDate(dateInput, type = 'full') {
    if (!dateInput) return '-';

    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string') {
      // string 'YYYY-MM-DD HH:mm:ss'
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
        return type === 'dateOnly' ? dateInput.slice(0,10) : dateInput;
      }
      // string 'YYYY-MM-DD'
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return type === 'dateOnly'
          ? dateInput
          : `${dateInput} 00:00:00`;
      }
      d = new Date(dateInput);
    } else {
      return dateInput;
    }

    if (isNaN(d.getTime())) return '-';

    const pad = n => n < 10 ? '0' + n : n;
    const year   = d.getFullYear();
    const month  = pad(d.getMonth() + 1);
    const day    = pad(d.getDate());
    const hour   = pad(d.getHours());
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());

    if (type === 'dateOnly') {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // Kirim chat action (typing, upload_photo, etc.)
  async sendChatAction(chatId, action) {
    const url = `${this.apiUrl}/sendChatAction`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (err) {
      console.error('Gagal mengirim chat action:', err);
    }
  }

  // Hapus pesan
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/deleteMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
    } catch (err) {
      console.error('Gagal menghapus pesan:', err);
    }
  }

  // Kirim pesan (teks, parse_mode opsional)
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options
    };
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }

  // Panggilan API cek kuota
  async checkQuota(msisdn) {
    const url = `https://api.geoproject.biz.id/cek_kuota?msisdn=${msisdn}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  }

  // Main handler untuk setiap update
  async handleUpdate(update) {
    const msg       = update.message;
    const chatId    = msg?.chat?.id;
    const messageId = msg?.message_id;
    const text      = msg?.text?.trim() || '';
    const from      = msg?.from || {};
    const username  = from.username || from.first_name || 'N/A';
    const userId    = from.id || 'N/A';

    if (!chatId || !text) return;

    // /help
    if (text.startsWith('/help')) {
      const helpText = `
ℹ️ <b>Bantuan Bot</b>

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisahkan spasi.  
• Contoh: 085666372626 085647728247
`;
      return this.sendMessage(chatId, helpText, { parse_mode: "HTML" });
    }

    // Pecah input jadi array nomor HP valid
    const phoneNumbers = text
      .split(/\s+/)
      .filter(num => num.startsWith('08') && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length === 0) {
      return this.sendMessage(
        chatId,
        'Maaf, saya tidak mengerti. Silakan kirim nomor HP yang ingin Anda cek kuotanya (contoh: `081234567890`) atau ketik `/help` untuk bantuan.',
        { parse_mode: 'Markdown' }
      );
    }

    // Tampilkan indikator mengetik
    await this.sendChatAction(chatId, 'typing');

    const allResponses = [];
    const now = new Date();
    const checkTime = CekkuotaBotku.formatDate(now, 'full');

    for (const number of phoneNumbers) {
      const parts = [];
      const sep = '============================';

      // Header info user
      parts.push(`🥷 <b>User</b> : ${CekkuotaBotku.escapeHTML(username)}`);
      parts.push(`🆔 <b>User ID</b> : ${CekkuotaBotku.escapeHTML(String(userId))}`);
      parts.push(`📆 <b>Waktu Pengecekan</b> : ${CekkuotaBotku.escapeHTML(checkTime)}`);
      parts.push('═══════════════════════════');

      try {
        const apiRes = await this.checkQuota(number);

        if (apiRes?.status === 'success' && apiRes.data?.data) {
          const info = apiRes.data.data;
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
          parts.push(`🆘 <b>Akhir Tenggang</b> : ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(grace_period?.value, 'dateOnly'))}`);

          // Kuota
          if (Array.isArray(quotas?.value) && quotas.value.length) {
            quotas.value.forEach(group => {
              if (!group.length) return;
              const pkg = group[0].packages;
              parts.push(sep);
              parts.push(`📦 <b>${CekkuotaBotku.escapeHTML(pkg?.name || '-')}</b>`);
              parts.push(`⏰ <b>Aktif Hingga</b> : ${CekkuotaBotku.escapeHTML(CekkuotaBotku.formatDate(pkg?.expDate, 'full'))}`);
              group[0].benefits?.forEach(b => {
                parts.push(`  🌀 <b>Benefit</b> : ${CekkuotaBotku.escapeHTML(b.bname || '-')}`);
                parts.push(`  🧢 <b>Tipe Kuota</b>: ${CekkuotaBotku.escapeHTML(b.type || '-')}`);
                parts.push(`  🎁 <b>Kuota</b> : ${CekkuotaBotku.escapeHTML(b.quota || '-')}`);
                parts.push(`  ⏳ <b>Sisa</b> : ${CekkuotaBotku.escapeHTML(b.remaining || '-')}`);
              });
            });
          } else {
            // Fallback parsing teks 'hasil' jika tidak ada struktur quotas
            const raw = info.hasil || '';
            const clean = raw
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/=/g, '')
              .replace(/📃 RESULT: \s*\n\n/g, '')
              .trim();

            if (clean.includes('🎁 Quota:')) {
              const sections = clean.split('🎁 Quota:').slice(1);
              sections.forEach(sec => {
                const lines = sec.split('\n').filter(l => l.trim());
                const name = lines[0]?.trim();
                const expLine = lines.find(l => l.startsWith('🍂 Aktif Hingga:'));
                const exp = expLine?.replace('🍂 Aktif Hingga:', '').trim() || '-';
                parts.push(sep);
                parts.push(`📦 <b>${CekkuotaBotku.escapeHTML(name)}</b>`);
                parts.push(`⏰ <b>Aktif Hingga</b> : ${CekkuotaBotku.escapeHTML(exp)}`);
              });
            } else if (clean) {
              parts.push(sep);
              parts.push(`❗ <b>Info</b>: ${CekkuotaBotku.escapeHTML(clean)}`);
            } else {
              // Pesan error umum
              parts.push(sep);
              parts.push(`❗ <b>Info</b>:`);
              parts.push(`Maaf, saat ini terjadi kendala dalam menampilkan detail info paket. Silakan coba lagi nanti atau periksa nomor Anda.`);
            }
          }
        } else {
          // Status bukan success
          parts.push(`☎️ <b>Nomor</b> : ${CekkuotaBotku.escapeHTML(number)}`);
          parts.push(sep);
          parts.push(`❗ <b>Info</b>: Maaf, tidak dapat mengambil data kuota untuk nomor ini.`);
        }

      } catch (err) {
        console.error(`Error cek kuota ${number}:`, err);
        parts.push(`☎️ <b>Nomor</b> : ${CekkuotaBotku.escapeHTML(number)}`);
        parts.push(sep);
        parts.push(`❗ <b>Info</b>: Terjadi kesalahan internal, silakan coba lagi nanti.`);
      }

      allResponses.push(`<blockquote>${parts.join('\n')}</blockquote>`);
    }

    // Kirim balasan gabungan
    await this.sendMessage(chatId, allResponses.join('\n\n'), { parse_mode: 'HTML' });

    // (Opsional) hapus pesan user
    if (messageId) {
      await this.deleteMessage(chatId, messageId);
    }
  }
}
