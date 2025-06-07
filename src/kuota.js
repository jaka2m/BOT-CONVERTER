export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';
    const username = message.from?.username ? '@' + message.from.username : '-';
    const userId = message.from?.id || '-';

    if (!chatId || !text) return;

    if (text.startsWith('/help')) {
      return this.sendMessage(chatId, `
ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisahkan dengan spasi.  
• Contoh: 085666372626 085647728247

Bot akan menampilkan informasi kuota dengan cepat dan mudah dibaca.
`, true);
    }

    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      // Siapkan header user info
      const waktu = formatDate(new Date());
      const userInfoLines = [
        `🥷 User : ${username}`,
        `🆔 User ID : ${userId}`,
        `📆 Waktu Pengecekan : ${waktu}`
      ];
      const separatorHeavy = "══════════════════════";

      // Proses tiap nomor
      const replies = await Promise.all(numbers.map(async (num) => {
        try {
          const res = await fetch(`https://jav.zerostore.web.id/cek_kuota?msisdn=${num}`);
          const data = await res.json();
          return formatQuotaResponse(num, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${num}:`, err);
          return `❌ Gagal cek kuota untuk ${num}`;
        }
      }));

      // Gabungkan dan quote tanpa baris kosong
      const fullLines = [
        ...userInfoLines,
        separatorHeavy,
        ...replies.flatMap(r => r.split('\n'))
      ];
      const quoted = fullLines
        .filter(line => line.trim() !== '')
        .map(line => `> ${line}`)
        .join('\n');

      return this.sendMessage(chatId, quoted, true);
    }

    return this.sendMessage(chatId, '❗ Mohon kirim nomor HP yang valid untuk dicek.', true);
  }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {})
    };
    try {
      await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}

// Bantuan format kuota
function formatQuotaResponse(number, data) {
  const info = data?.data?.data_sp;
  const separatorLight = "==========================";

  if (!data || !data.status || !info) {
    return `⚠️ Nomor ${number} tidak ditemukan atau terjadi kesalahan.`;
  }

  const {
    quotas,
    status_4g,
    dukcapil,
    grace_period,
    active_period,
    active_card,
    prefix
  } = info;

  const lines = [];
  lines.push(`☎️ Nomor : ${number}`);
  lines.push(`📡 Tipe Kartu : ${prefix?.value || '-'}`);
  lines.push(`📶 Status Kartu : ${status_4g?.value || '-'}`);
  lines.push(`🪪 Status Dukcapil : ${dukcapil?.value || '-'}`);
  lines.push(`🗓️ Umur Kartu : ${active_card?.value || '-'}`);
  lines.push(`🚓 Masa Aktif : ${active_period?.value || '-'}`);
  lines.push(`🆘 Akhir Tenggang : ${grace_period?.value || '-'}`);

  if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
    quotas.value.forEach(group => {
      if (!group.length) return;
      const pkg = group[0].packages;
      lines.push(separatorLight);
      lines.push(`📦 ${pkg?.name || '-'}`);
      lines.push(`⏰ Aktif Hingga : ${formatDate(pkg?.expDate) || '-'}`);
      if (group[0].benefits?.length) {
        group[0].benefits.forEach(b => {
          lines.push(`  🌀 Benefit : ${b.bname}`);
          lines.push(`  🧢 Tipe Kuota : ${b.type}`);
          lines.push(`  🎁 Kuota : ${b.quota}`);
          lines.push(`  ⏳ Sisa Kuota : ${b.remaining}`);
        });
      }
    });
  } else {
    const raw = data?.data?.hasil || '';
    const text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    lines.push(separatorLight);
    lines.push(`❗ Info: ${text}`);
  }

  return lines.join('\n');
}

// Format tanggal
function formatDate(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d)) return String(dateInput);
  const pad = n => n < 10 ? '0' + n : n;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
