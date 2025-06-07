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

    // Ambil semua nomor HP 10–13 digit
    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      const username = message.from?.username ? '@' + message.from.username : '(tidak diketahui)';
      const userId = message.from?.id || '(tidak diketahui)';
      const waktu = formatDate(new Date());

      // Informasi user di bagian paling atas
      const userInfo = [
        `🥷 User : ${username}`,
        `🆔 User ID : ${userId}`,
        `📆 Waktu Pengecekan :`,
        `  ${waktu}`,
      ].join('\n');

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

      // Gabungkan userInfo + separator + masing-masing hasil
      const separatorHeavy = "══════════════════════";
      const fullMessage = [userInfo, separatorHeavy, ...replies].join('\n\n');
      return this.sendMessage(chatId, fullMessage, true);
    }

    // Jika tidak ada nomor valid
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

// Fungsi bantu di luar class
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

  // Header informasi utama tentang kartu
  const lines = [];
  lines.push(`☎️ Nomor : ${number}`);
  lines.push(`📡 Tipe Kartu : ${prefix?.value || '-'}`);
  lines.push(`📶 Status Kartu : ${status_4g?.value || '-'}`);
  lines.push(`🪪 Status Dukcapil : ${dukcapil?.value || '-'}`);
  lines.push(`🗓️ Umur Kartu : ${active_card?.value || '-'}`);
  lines.push(`🚓 Masa Aktif : ${active_period?.value || '-'}`);
  lines.push(`🆘 Akhir Tenggang : ${grace_period?.value || '-'}`);

  // Jika ada detail paket kuota
  if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
    quotas.value.forEach((quotaGroup) => {
      if (quotaGroup.length === 0) return;

      const packageInfo = quotaGroup[0].packages;
      // Judul paket
      lines.push(separatorLight);
      lines.push(`📦 ${packageInfo?.name || '-'}`);
      lines.push(`⏰ Aktif Hingga : ${formatDate(packageInfo?.expDate) || '-'}`);

      // Jika ada benefit di dalam paket
      if (quotaGroup[0].benefits && quotaGroup[0].benefits.length > 0) {
        lines.push(separatorLight);
        quotaGroup[0].benefits.forEach((benefit) => {
          lines.push(`  🌀 Benefit : ${benefit.bname}`);
          lines.push(`  🧢 Tipe Kuota : ${benefit.type}`);
          lines.push(`  🎁 Kuota : ${benefit.quota}`);
          lines.push(`  ⏳ Sisa Kuota : ${benefit.remaining}`);
        });
      }
    });
  } else {
    // Fallback: tampilkan hasil mentah tanpa HTML
    const hasilRaw = data?.data?.hasil || '';
    const hasilText = hasilRaw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    lines.push(separatorLight);
    lines.push(`❗ Info:\n${hasilText}`);
  }

  return lines.join('\n');
}

function formatDate(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d)) return String(dateInput);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
