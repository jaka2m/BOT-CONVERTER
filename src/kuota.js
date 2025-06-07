export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const msg    = update.message;
    const chatId = msg?.chat?.id;
    const text   = msg?.text?.trim() || '';
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

    // ambil semua nomor 10–13 digit
    const numbers = text.match(/\d{10,13}/g);
    if (!numbers?.length) {
      return this.sendMessage(chatId,
        "❗ Mohon kirim nomor HP yang valid untuk dicek.",
        { parse_mode: "HTML" }
      );
    }

    // bikin header blockquote
    const username = msg.from?.username ? '@'+msg.from.username : '-';
    const userId   = msg.from?.id       || '-';
    const waktu    = formatDate(new Date());
    const header = `<blockquote>
🥷 <b>User</b>     : ${escapeHTML(username)}
🆔 <b>User ID</b>  : ${escapeHTML(userId)}
📆 <b>Waktu</b>    : ${escapeHTML(waktu)}
══════════════════════
`;

    // fetch & format setiap nomor
    const parts = [];
    for (let no of numbers) {
      try {
        const res  = await fetch(`https://api.geoproject.biz.id/cek_kuota?msisdn=${no}`);
        const data = await res.json();
        parts.push(formatQuotaResponse(no, data));
      } catch (e) {
        console.error(e);
        parts.push(`❌ Gagal cek kuota untuk ${escapeHTML(no)}`);
      }
    }

    const footer = `</blockquote>`;
    const fullHtml = header + parts.join("\n\n") + footer;

    return this.sendMessage(chatId, fullHtml, { parse_mode: "HTML" });
  }

  async sendMessage(chatId, text, opts = {}) {
    const payload = { chat_id: chatId, text, ...opts };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}

// =================================================================================
// Helper: escape hanya konten dinamis, biarkan tag HTML apa adanya
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =================================================================================
// Format kuota dengan HTML tags
function formatQuotaResponse(number, data) {
  const info = data?.data?.data_sp;

  if (!data?.status) {
    return `⚠️ Nomor ${escapeHTML(number)} gagal dicek: ${escapeHTML(data?.message || 'Tidak diketahui')}`;
  }

  if (!info) {
    // fallback kalau `data_sp` tidak tersedia, tapi `hasil` ada
    const raw = data?.data?.hasil || '';
    const txt = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    return `📃 <b>Nomor:</b> ${escapeHTML(number)}\n\n${escapeHTML(txt)}`;
  }

  const { quotas, status_4g, dukcapil, grace_period, active_period, active_card, prefix } = info;
  const sep = "==========================";

  const out = [];
  out.push(`☎️ <b>Nomor</b>         : ${escapeHTML(number)}`);
  out.push(`📡 <b>Tipe Kartu</b>    : ${escapeHTML(prefix?.value || '-')}`);
  out.push(`📶 <b>Status Kartu</b> : ${escapeHTML(status_4g?.value || '-')}`);
  out.push(`🪪 <b>Dukcapil</b>      : ${escapeHTML(dukcapil?.value || '-')}`);
  out.push(`🗓️ <b>Umur Kartu</b>   : ${escapeHTML(active_card?.value || '-')}`);
  out.push(`🚓 <b>Masa Aktif</b>   : ${escapeHTML(active_period?.value || '-')}`);
  out.push(`🆘 <b>Akhir Tenggang</b>: ${escapeHTML(grace_period?.value || '-')}`);

  if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
    quotas.value.forEach(group => {
      if (!group.length) return;
      const pkg = group[0].packages;
      out.push(sep);
      out.push(`📦 <b>${escapeHTML(pkg?.name || '-')}</b>`);
      out.push(`⏰ <b>Aktif Hingga</b>: ${escapeHTML(formatDate(pkg?.expDate))}`);
      group[0].benefits?.forEach(b => {
        out.push(`  🌀 <b>Benefit</b>    : ${escapeHTML(b.bname)}`);
        out.push(`  🧢 <b>Tipe Kuota</b>: ${escapeHTML(b.type)}`);
        out.push(`  🎁 <b>Kuota</b>     : ${escapeHTML(b.quota)}`);
        out.push(`  ⏳ <b>Sisa</b>      : ${escapeHTML(b.remaining)}`);
      });
    });
  } else {
    const raw = data?.data?.hasil || '';
    const txt = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    out.push(sep);
    out.push(`❗ <b>Info</b>: ${escapeHTML(txt)}`);
  }

  return out.join("\n");
}

// =================================================================================
// Format Date ke YYYY-MM-DD HH:mm:ss
function formatDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return String(input);
  const pad = n => n<10?'0'+n:n;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
