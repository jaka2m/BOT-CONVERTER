import fetch from 'node-fetch';

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.offset = 0; // untuk polling update Telegram
  }

  // Fungsi escape Markdown v1 (bukan v2), supaya pesan tidak error
  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
  }

  // Memecah pesan panjang jadi array pesan max ~4000 char per pesan
  splitMessage(text, maxLength = 4000) {
    if (text.length <= maxLength) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      let end = start + maxLength;
      if (end > text.length) end = text.length;

      // Usahakan split di newline supaya pesan tidak terpotong asal
      let splitPos = text.lastIndexOf('\n', end);
      if (splitPos <= start) splitPos = end; // jika tidak ketemu newline, split paksa

      chunks.push(text.slice(start, splitPos).trim());
      start = splitPos;
    }
    return chunks;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!chatId || !text) return;

    if (text.startsWith('/start')) {
      return this.sendMessage(chatId, 
`👋 Halo! Selamat datang di *Bot Sidompul Regar Store*.

Kirim nomor HP kamu dan pisahkan dengan spasi (misalnya: 087834567890 087865567890) untuk cek informasi kuota.

Bot ini akan membalas otomatis dengan detail kuota Anda. 📶
`, true);
    }

    if (text.startsWith('/help')) {
      return this.sendMessage(chatId, 
`ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisahkan dengan spasi.  
• Contoh: 082112345678 085612345678

Bot akan menampilkan informasi kuota dengan cepat dan mudah dibaca.
`, true);
    }

    if (text.startsWith('/owner')) {
      return this.sendMessage(chatId, `👑 *Owner Bot*: @YourUsername`, true);
    }

    // Regex ambil nomor HP: mulai dengan 08, 10-13 digit angka
    const numbers = text.match(/\b08\d{8,11}\b/g);
    if (numbers && numbers.length > 0) {
      const replies = await Promise.all(numbers.map(async (num) => {
        try {
          const res = await fetch(`https://dom.checker-ip.web.id/cek_kuota?msisdn=${num}`);
          const data = await res.json();
          return this.formatQuotaResponse(num, data);
        } catch (err) {
          console.error(`Error fetching kuota untuk ${num}:`, err);
          return `❌ Gagal cek kuota untuk ${this.escapeMarkdown(num)}`;
        }
      }));

      const fullReply = replies.join('\n\n');
      // Telegram batasan pesan, split jika perlu
      const parts = this.splitMessage(fullReply, 4000);

      for (const part of parts) {
        await this.sendMessage(chatId, part, true);
      }
      return;
    }

    return this.sendMessage(chatId, '❗ Mohon kirim nomor HP yang valid untuk dicek.', true);
  }

  formatQuotaResponse(number, data) {
    const info = data?.data?.data_sp;

    if (!data || !data.status || !info) {
      return `⚠️ Nomor ${this.escapeMarkdown(number)} tidak ditemukan atau terjadi kesalahan.`;
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

    let msg = `📱 *Nomor:* ${this.escapeMarkdown(number)}\n`;
    msg += `• Tipe Kartu: ${this.escapeMarkdown(prefix?.value || '-')}\n`;
    msg += `• Umur Kartu: ${this.escapeMarkdown(active_card?.value || '-')}\n`;
    msg += `• Status Dukcapil: ${this.escapeMarkdown(dukcapil?.value || '-')}\n`;
    msg += `• Status 4G: ${this.escapeMarkdown(status_4g?.value || '-')}\n`;
    msg += `• Masa Aktif: ${this.escapeMarkdown(active_period?.value || '-')}\n`;
    msg += `• Masa Tenggang: ${this.escapeMarkdown(grace_period?.value || '-')}\n\n`;

    if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
      msg += `📦 *Detail Paket Kuota:*\n`;
      quotas.value.forEach((quotaGroup) => {
        if (quotaGroup.length === 0) return;
        const packageInfo = quotaGroup[0].packages;
        msg += `\n🎁 Paket: ${this.escapeMarkdown(packageInfo?.name || '-')}\n`;
        msg += `📅 Aktif Hingga: ${this.escapeMarkdown(this.formatDate(packageInfo?.expDate) || '-')}\n`;

        if (quotaGroup[0].benefits && quotaGroup[0].benefits.length > 0) {
          quotaGroup[0].benefits.forEach(benefit => {
            msg += `• Benefit: ${this.escapeMarkdown(benefit.bname)}\n`;
            msg += `  Tipe Kuota: ${this.escapeMarkdown(benefit.type)}\n`;
            msg += `  Kuota: ${this.escapeMarkdown(benefit.quota)}\n`;
            msg += `  Sisa Kuota: ${this.escapeMarkdown(benefit.remaining)}\n`;
          });
        }
        msg += `-----------------------------\n`;
      });
    } else {
      const hasilRaw = data?.data?.hasil || '';
      const hasilText = hasilRaw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      msg += `❗ Info:\n${this.escapeMarkdown(hasilText)}\n`;
    }

    return msg.trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
  }

  pad(n) {
    return n < 10 ? '0' + n : n;
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

  // Contoh polling update sederhana (gunakan node-fetch)
  async pollUpdates() {
    try {
      const url = `${this.apiUrl}/bot${this.token}/getUpdates?offset=${this.offset + 1}&timeout=20`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok && json.result.length > 0) {
        for (const update of json.result) {
          this.offset = update.update_id;
          await this.handleUpdate(update);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }
}

// Contoh sederhana run polling (panggil ini di main)
// const bot = new TelegramCekkuota('YOUR_BOT_TOKEN_HERE');
// setInterval(() => bot.pollUpdates(), 3000);
