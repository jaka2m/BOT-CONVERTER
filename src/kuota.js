const QUOTA_CHECK_API = 'https://api.geoproject.biz.id/cek_kuota?msisdn=';

export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  // Fungsi escapeHTML untuk mencegah masalah parsing HTML di Telegram
  escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Fungsi untuk mengirim aksi chat (misal: mengetik)
  async sendChatAction(chatId, action) {
    try {
      await fetch(`${this.apiUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (err) {
      console.error('Gagal mengirim chat action:', err);
    }
  }

  // Fungsi untuk menghapus pesan
  async deleteMessage(chatId, messageId) {
    try {
      await fetch(`${this.apiUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
    } catch (err) {
      console.error('Gagal menghapus pesan:', err);
    }
  }

  // Handler update Telegram
  async handleUpdate(update) {
    const message   = update.message;
    const chatId    = message?.chat?.id;
    const messageId = message?.message_id;
    const text      = message?.text?.trim() || '';
    const userId    = message?.from?.id;
    const username  = message?.from?.username;

    if (!chatId || !text) return;

    // /help dengan Markdown
    if (text.startsWith('/help')) {
      return this.sendMessage(
        chatId,
        `
ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisah spasi.  
• Contoh: 082112345678 085612345678  

Bot akan menampilkan info kuota cepat & mudah dibaca.
        `,
        'Markdown'
      );
    }

    const phoneNumbers = text
      .split(/\s+/)
      .filter(num => num.startsWith('08') && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length === 0) {
      return this.sendMessage(
        chatId,
        'Maaf, saya tidak mengerti. Kirim nomor (contoh: `081234567890`) atau ketik `/help`.',
        'Markdown'
      );
    }

    // Kirim typing…
    await this.sendChatAction(chatId, 'typing');

    const allResponses = [];
    const now           = new Date();
    const checkTimeText = formatDate(now, 'full');

    for (const number of phoneNumbers) {
      const respLines = [];
      const sep       = '============================';

      respLines.push(`🥷 <b>User</b> : ${this.escapeHTML(username || 'N/A')}`);
      respLines.push(`🆔 <b>User ID</b> : ${this.escapeHTML(userId)}`);
      respLines.push(`📆 <b>Waktu Pengecekan</b> : ${this.escapeHTML(checkTimeText)}`);
      respLines.push('═══════════════════════════');

      try {
        const apiRes = await this.checkQuota(number);

        if (apiRes?.status === 'success' && apiRes.data?.data) {
          const info = apiRes.data.data;
          const sp   = info.data_sp;
          const {
            quotas,
            status_4g,
            dukcapil,
            grace_period,
            active_period,
            active_card,
            prefix
          } = sp;

          respLines.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(info.msisdn || '-')}`);
          respLines.push(`📡 <b>Tipe Kartu</b> : ${this.escapeHTML(prefix?.value || '-')}`);
          respLines.push(`📶 <b>Status Kartu</b> : ${this.escapeHTML(status_4g?.value || '-')}`);
          respLines.push(`🪪 <b>Status Dukcapil</b> : ${this.escapeHTML(dukcapil?.value || '-')}`);
          respLines.push(`🗓️ <b>Umur Kartu</b> : ${this.escapeHTML(active_card?.value || '-')}`);
          respLines.push(
            `🚓 <b>Masa Aktif</b> : ${this.escapeHTML(formatDate(active_period?.value, 'dateOnly') || '-')}`
          );
          respLines.push(
            `🆘 <b>Akhir Tenggang</b> : ${this.escapeHTML(formatDate(grace_period?.value, 'dateOnly') || '-')}`
          );

          if (Array.isArray(quotas?.value) && quotas.value.length) {
            quotas.value.forEach(group => {
              if (!group.length) return;
              const pkg = group[0].packages;
              respLines.push(sep);
              respLines.push(`📦 <b>${this.escapeHTML(pkg?.name || '-')}</b>`);
              respLines.push(
                `⏰ <b>Aktif Hingga</b> : ${this.escapeHTML(formatDate(pkg?.expDate, 'full'))}`
              );
              group[0].benefits?.forEach(b => {
                respLines.push(`  🌀 <b>Benefit</b> : ${this.escapeHTML(b.bname || '-')}`);
                respLines.push(`  🧢 <b>Tipe Kuota</b>: ${this.escapeHTML(b.type || '-')}`);
                respLines.push(`  🎁 <b>Kuota</b> : ${this.escapeHTML(b.quota || '-')}`);
                respLines.push(`  ⏳ <b>Sisa</b> : ${this.escapeHTML(b.remaining || '-')}`);
              });
            });
          } else {
            // fallback parsing hasil raw text…
            const raw = info.hasil || '';
            const isErr = raw.includes('Maaf, saat ini terjadi kendala');
            if (!isErr) {
              const clean = raw
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/=/g, '')
                .replace(/📃 RESULT: \s*\n\n/g, '')
                .trim();

              if (clean.includes('🎁 Quota:')) {
                const sections = clean.split('🎁 Quota:');
                for (let i = 1; i < sections.length; i++) {
                  const lines = sections[i].trim().split('\n').filter(l => l);
                  const pkgName = lines[0]?.trim();
                  const expLine = lines.find(l => l.startsWith('🍂 Aktif Hingga:'));
                  const expDate = expLine?.replace('🍂 Aktif Hingga:', '').trim() || null;
                  if (pkgName && expDate) {
                    respLines.push(sep);
                    respLines.push(`📦 <b>${this.escapeHTML(pkgName)}</b>`);
                    respLines.push(`⏰ <b>Aktif Hingga</b> : ${this.escapeHTML(expDate)}`);
                  }
                }
              } else if (clean) {
                respLines.push(sep);
                respLines.push(`❗ <b>Info</b>: ${this.escapeHTML(clean)}`);
              } else {
                // default error info
                respLines.push(sep);
                respLines.push(`❗ <b>Info</b>:`);
                respLines.push(
                  `Maaf, saat ini terjadi kendala menampilkan detail paket. Coba lagi nanti.`
                );
              }
            } else {
              respLines.push(sep);
              respLines.push(`❗ <b>Info</b>:`);
              respLines.push(
                `Maaf, saat ini terjadi kendala menampilkan detail paket. Coba lagi nanti.`
              );
            }
          }
        } else {
          // jika API gagal/kosong
          respLines.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(number)}`);
          respLines.push('============================');
          respLines.push(`❗ <b>Info</b>: Maaf, terjadi kendala. Coba lagi nanti.`);
        }

      } catch (err) {
        console.error(`Error checking quota for ${number}:`, err);
        respLines.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(number)}`);
        respLines.push('============================');
        respLines.push(`Terjadi kesalahan internal. Silakan coba lagi nanti.`);
      }

      allResponses.push(`<blockquote>${respLines.join('\n')}</blockquote>`);
    }

    // Kirim seluruh balasan
    await this.sendMessage(chatId, allResponses.join('\n\n'), 'HTML');
    // Hapus pesan user
    await this.deleteMessage(chatId, messageId);
  }

  // Memanggil API quota
  async checkQuota(msisdn) {
    try {
      const res = await fetch(`${QUOTA_CHECK_API}${msisdn}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('Error fetching quota:', err);
      throw err;
    }
  }

  // Kirim pesan ke Telegram
  async sendMessage(chatId, text, parseMode = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(parseMode === 'Markdown' ? { parse_mode: "Markdown" } : {}),
      ...(parseMode === 'HTML'     ? { parse_mode: "HTML" }     : {})
    };
    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}

// Utility di luar kelas
function formatDate(dateInput, type = 'full') {
  if (!dateInput) return '-';
  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
      return type === 'dateOnly' ? dateInput.slice(0,10) : dateInput;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return type === 'full' ? `${dateInput} 00:00:00` : dateInput;
    }
    d = new Date(dateInput);
  } else {
    return dateInput;
  }
  if (isNaN(d.getTime())) return '-';

  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());

  if (type === 'dateOnly') return `${Y}-${M}-${D}`;
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
