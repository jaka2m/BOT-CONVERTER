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
    const username = message?.from?.username || '-';
    const userId = message?.from?.id || '-';

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
      const waktu = formatDate(new Date());
      const userInfo = `🥷 User : @${username}\n🆔 User ID : ${userId}\n📆 Waktu Pengecekan :\n ${waktu}`;
      const separatorHeavy = "══════════════════════";

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

      const fullMessage = [userInfo, separatorHeavy, ...replies].join('\n\n');
      const quoted = quoteText(fullMessage);

      return this.sendMessage(chatId, quoted, true);
    }
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

// Format tampilan kuota
function formatQuotaResponse(number, data) {
  const info = data?.data?.data_sp;

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

  let msg = `☎️ Nomor : ${number}`;
  msg += `\n📡 Tipe Kartu : ${prefix?.value || '-'}`;
  msg += `\n📶 Status Kartu : ${status_4g?.value || '-'}`;
  msg += `\n🪪 Status Dukcapil : ${dukcapil?.value || '-'}`;
  msg += `\n🗓️ Umur Kartu : ${active_card?.value || '-'}`;
  msg += `\n🚓 Masa Aktif : ${active_period?.value || '-'}`;
  msg += `\n🆘 Akhir Tenggang : ${grace_period?.value || '-'}`;

  if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
    quotas.value.forEach((quotaGroup) => {
      if (quotaGroup.length === 0) return;

      const pkg = quotaGroup[0].packages;
      msg += `\n===========================`;
      msg += `\n📦 ${pkg?.name || '-'}`;
      msg += `\n⏰ Aktif Hingga : ${formatDate(pkg?.expDate) || '-'}`;

      quotaGroup[0].benefits?.forEach((benefit) => {
        msg += `\n  🌀 Benefit : ${benefit.bname}`;
        msg += `\n  🧢 Tipe Kuota : ${benefit.type}`;
        msg += `\n  🎁 Kuota : ${benefit.quota}`;
        msg += `\n  ⏳ Sisa Kuota : ${benefit.remaining}`;
      });
    });
  } else {
    const hasilRaw = data?.data?.hasil || '';
    const hasilText = hasilRaw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    msg += `\n❗ Info:\n${hasilText}`;
  }

  return msg.trim();
}

// Format kutipan Telegram
function quoteText(text) {
  return text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

// Format waktu
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
