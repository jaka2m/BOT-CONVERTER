export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const msg = update.message;
    const chatId = msg?.chat?.id;
    const text   = msg?.text?.trim() || '';
    if (!chatId || !text) return;

    // /help handler tetap sama
    if (text.startsWith('/help')) {
      return this.sendMessage(chatId, `
ℹ️ <b>Bantuan Bot</b>

• Kirim nomor HP untuk cek kuota.
• Format: 08xxxxxx atau 1+ nomor dipisah spasi.
• Contoh: 085666372626 085647728247
`, { parse_mode: "HTML" });
    }

    // ambil nomor
    const numbers = text.match(/\d{10,13}/g);
    if (!numbers?.length) {
      return this.sendMessage(chatId,
        "❗ Mohon kirim nomor HP yang valid untuk dicek.",
        { parse_mode: "HTML" }
      );
    }

    // Siapkan header user info
    const username = msg.from?.username ? '@'+msg.from.username : '-';
    const userId   = msg.from?.id       || '-';
    const waktu    = formatDate(new Date());
    const header = `
<blockquote>
🥷 <b>User</b>     : ${username}
🆔 <b>User ID</b>  : ${userId}
📆 <b>Waktu</b>    : ${waktu}
══════════════════════
`;

    // fetch & format tiap nomor
    const lines = [];
    for (let num of numbers) {
      try {
        const res  = await fetch(`https://jav.zerostore.web.id/cek_kuota?msisdn=${num}`);
        const data = await res.json();
        lines.push(formatQuotaResponse(num, data));
      }
      catch(e) {
        console.error(e);
        lines.push(`❌ Gagal cek kuota untuk ${num}`);
      }
    }

    // tutup blockquote
    const footer = `</blockquote>`;

    // kirim semuanya sebagai HTML
    const html = header + lines.join("\n\n") + footer;
    return this.sendMessage(chatId, html, { parse_mode: "HTML" });
  }

  async sendMessage(chatId, text, opts = {}) {
    const payload = {
      chat_id: chatId,
      text,
      ...opts
    };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}

// helper: format kuota (mirip sebelumnya, tapi pakai HTML-safe)
function formatQuotaResponse(number, data) {
  const info = data?.data?.data_sp;
  if (!data?.status || !info) {
    return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
  }

  const { quotas, status_4g, dukcapil, grace_period, active_period, active_card, prefix } = info;
  const sep = "==========================";

  const out = [];
  out.push(`☎️ <b>Nomor</b>         : ${number}`);
  out.push(`📡 <b>Tipe Kartu</b>    : ${prefix?.value || '-'}`);
  out.push(`📶 <b>Status Kartu</b> : ${status_4g?.value || '-'}`);
  out.push(`🪪 <b>Dukcapil</b>      : ${dukcapil?.value || '-'}`);
  out.push(`🗓️ <b>Umur Kartu</b>   : ${active_card?.value || '-'}`);
  out.push(`🚓 <b>Masa Aktif</b>   : ${active_period?.value || '-'}`);
  out.push(`🆘 <b>Akhir Tenggang</b>: ${grace_period?.value || '-'}`);

  if (Array.isArray(quotas?.value)) {
    quotas.value.forEach(group => {
      if (!group.length) return;
      const pkg = group[0].packages;
      out.push(sep);
      out.push(`📦 <b>${pkg?.name || '-'}</b>`);
      out.push(`⏰ <b>Aktif Hingga</b>: ${formatDate(pkg?.expDate)}`);
      group[0].benefits?.forEach(b => {
        out.push(`  🌀 <b>Benefit</b>    : ${b.bname}`);
        out.push(`  🧢 <b>Tipe Kuota</b>: ${b.type}`);
        out.push(`  🎁 <b>Kuota</b>     : ${b.quota}`);
        out.push(`  ⏳ <b>Sisa</b>      : ${b.remaining}`);
      });
    });
  } else {
    const raw = data?.data?.hasil || '';
    const txt = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    out.push(sep);
    out.push(`❗ <b>Info</b>: ${txt}`);
  }

  // escape & wrap jadi satu string HTML
  return out.map(l => l.replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;"))
            .join("\n");
}

function formatDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d)) return String(d);
  const pad = n => n<10?'0'+n:n;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
