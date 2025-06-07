export async function cekkuota(link) {
  console.log("Bot link:", link);
}

const QUOTA_CHECK_API = 'https://api.geoproject.biz.id/cek_kuota?msisdn=';

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = `${apiUrl}/bot${token}`;
  }

  escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async sendChatAction(chatId, action) {
    try {
      await fetch(`${this.apiUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action }),
      });
    } catch (err) {
      console.error('Gagal mengirim chat action:', err);
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      await fetch(`${this.apiUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
    } catch (err) {
      console.error('Gagal menghapus pesan:', err);
    }
  }

  async sendMessage(chatId, text, parseMode = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(parseMode === 'Markdown' ? { parse_mode: "Markdown" } : {}),
      ...(parseMode === 'HTML' ? { parse_mode: "HTML" } : {}),
    };
    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }

  async checkQuota(msisdn) {
    try {
      const response = await fetch(`${QUOTA_CHECK_API}${msisdn}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching quota:', error);
      throw error;
    }
  }

  formatDate(dateInput, type = 'full') {
    if (!dateInput) return '-';

    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        if (type === 'dateOnly') {
          return dateInput.substring(0, 10);
        }
        return dateInput;
      }
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        if (type === 'full') {
          return `${dateInput} 00:00:00`;
        }
        return dateInput;
      }
      d = new Date(dateInput);
    } else {
      return dateInput;
    }

    if (isNaN(d.getTime())) return '-';

    const year = d.getFullYear();
    const month = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hours = this.pad(d.getHours());
    const minutes = this.pad(d.getMinutes());
    const seconds = this.pad(d.getSeconds());

    if (type === 'dateOnly') {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  pad(n) {
    return n < 10 ? '0' + n : n;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const text = message?.text?.trim() || '';
    const userId = message?.from?.id;
    const username = message?.from?.username;

    if (!chatId || !text) return;

    if (text.startsWith('/help')) {
      return this.sendMessage(chatId, `
ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.
• Format: 08xxxxxx atau beberapa nomor dipisahkan dengan spasi.
• Contoh: 082112345678 085612345678

Bot akan menampilkan informasi kuota dengan cepat dan mudah dibaca.
`, 'Markdown');
    }

    const phoneNumbers = text.split(/\s+/).filter(num => num.startsWith('08') && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length > 0) {
      await this.sendChatAction(chatId, 'typing');

      let allResponses = [];
      const currentTime = new Date();
      const formattedCheckTime = this.formatDate(currentTime, 'full');

      for (const number of phoneNumbers) {
        const currentNumberResponse = [];
        const sep = "============================";

        currentNumberResponse.push(`🥷 <b>User</b> : ${this.escapeHTML(username || 'N/A')}`);
        currentNumberResponse.push(`🆔 <b>User ID</b> : ${this.escapeHTML(userId)}`);
        currentNumberResponse.push(`📆 <b>Waktu Pengecekan</b> : ${this.escapeHTML(formattedCheckTime)}`);
        currentNumberResponse.push(`═══════════════════════════`);

        try {
          const apiResponse = await this.checkQuota(number);

          // ... (You can include your full quota formatting logic here, unchanged)

          // For demo just show a simple message:
          if (apiResponse && apiResponse.status === 'success') {
            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(number)}`);
            currentNumberResponse.push('✅ Data kuota berhasil ditemukan.');
          } else {
            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(number)}`);
            currentNumberResponse.push('❗ Gagal mendapatkan data kuota.');
          }
        } catch (error) {
          currentNumberResponse.push(`☎️ <b>Nomor</b> : ${this.escapeHTML(number)}`);
          currentNumberResponse.push('⚠️ Terjadi kesalahan saat mengambil data kuota.');
        }

        allResponses.push(currentNumberResponse.join('\n'));
      }

      await this.sendMessage(chatId, allResponses.join('\n\n'), 'HTML');

      // Optional: delete the user message after reply
      await this.deleteMessage(chatId, messageId);
    } else {
      return this.sendMessage(chatId, 'Maaf, saya tidak mengerti. Silakan kirim nomor HP yang ingin Anda cek kuotanya (contoh: `081234567890`) atau ketik `/help` untuk bantuan.', 'Markdown');
    }
  }
}
