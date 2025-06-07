export async function cekkuota(link) {
  console.log("Bot link:", link);
}

export class CekkuotaBotku {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async sendMessage(chatId, text, options = {}) {
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });
  }

  async sendChatAction(chatId, action) {
    try {
      await fetch(`${this.apiUrl}/bot${this.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch (err) {
      console.error('Gagal mengirim chat action:', err);
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
    } catch (err) {
      console.error('Gagal menghapus pesan:', err);
    }
  }

  async handleUpdate(update) {
    const msg = update.message;
    const chatId = msg?.chat?.id;
    const text = msg?.text?.trim() || '';
    const username = msg?.from?.username || 'N/A';
    const userId = msg?.from?.id || 'N/A';
    const messageId = msg?.message_id;

    if (!chatId || !text) return;

    if (text.startsWith('/help')) {
      const helpText = `
ℹ️ <b>Bantuan Bot</b>

• Kirim nomor HP untuk cek kuota.  
• Format: 08xxxxxx atau beberapa nomor dipisahkan spasi.  
• Contoh: 085666372626 085647728247
`;
      return this.sendMessage(chatId, helpText, { parse_mode: "HTML" });
    }

    const phoneNumbers = text.split(/\s+/).filter(num => num.startsWith('08') && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length > 0) {
      await this.sendChatAction(chatId, 'typing');

      let allResponses = [];
      const currentTime = new Date();
      const formattedCheckTime = formatDate(currentTime, 'full');

      for (const number of phoneNumbers) {
        const currentNumberResponse = [];
        const sep = "============================";

        currentNumberResponse.push(`🥷 <b>User</b> : ${escapeHTML(username)}`);
        currentNumberResponse.push(`🆔 <b>User ID</b> : ${escapeHTML(userId)}`);
        currentNumberResponse.push(`📆 <b>Waktu Pengecekan</b> : ${escapeHTML(formattedCheckTime)}`);
        currentNumberResponse.push(`═══════════════════════════`);

        try {
          const apiResponse = await checkQuota(number);

          if (apiResponse?.status === 'success' && apiResponse.data?.data) {
            const info = apiResponse.data.data;
            const { quotas, status_4g, dukcapil, grace_period, active_period, active_card, prefix } = info.data_sp;

            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(info.msisdn || '-')}`);
            currentNumberResponse.push(`📡 <b>Tipe Kartu</b> : ${escapeHTML(prefix?.value || '-')}`);
            currentNumberResponse.push(`📶 <b>Status Kartu</b> : ${escapeHTML(status_4g?.value || '-')}`);
            currentNumberResponse.push(`🪪 <b>Status Dukcapil</b> : ${escapeHTML(dukcapil?.value || '-')}`);
            currentNumberResponse.push(`🗓️ <b>Umur Kartu</b> : ${escapeHTML(active_card?.value || '-')}`);
            currentNumberResponse.push(`🚓 <b>Masa Aktif</b> : ${escapeHTML(formatDate(active_period?.value, 'dateOnly') || '-')}`);
            currentNumberResponse.push(`🆘 <b>Akhir Tenggang</b> : ${escapeHTML(formatDate(grace_period?.value, 'dateOnly') || '-')}`);

            if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
              quotas.value.forEach(group => {
                if (!group.length) return;
                const pkg = group[0].packages;
                currentNumberResponse.push(sep);
                currentNumberResponse.push(`📦 <b>${escapeHTML(pkg?.name || '-')}</b>`);
                currentNumberResponse.push(`⏰ <b>Aktif Hingga</b> : ${escapeHTML(formatDate(pkg?.expDate, 'full'))}`);
                group[0].benefits?.forEach(b => {
                  currentNumberResponse.push(`  🌀 <b>Benefit</b> : ${escapeHTML(b.bname || '-')}`);
                  currentNumberResponse.push(`  🧢 <b>Tipe Kuota</b>: ${escapeHTML(b.type || '-')}`);
                  currentNumberResponse.push(`  🎁 <b>Kuota</b> : ${escapeHTML(b.quota || '-')}`);
                  currentNumberResponse.push(`  ⏳ <b>Sisa</b> : ${escapeHTML(b.remaining || '-')}`);
                });
              });
            } else {
              const rawHasilText = info.hasil || '';
              const cleanHasilText = rawHasilText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/=/g, '').trim();

              if (cleanHasilText.includes("🎁 Quota:")) {
                const quotaSections = cleanHasilText.split('🎁 Quota:');
                for (let i = 1; i < quotaSections.length; i++) {
                  const lines = quotaSections[i].trim().split('\n').filter(Boolean);
                  const packageName = lines[0]?.trim();
                  const expDate = lines.find(line => line.startsWith('🍂 Aktif Hingga:'))?.split(':')[1]?.trim();
                  if (packageName && expDate) {
                    currentNumberResponse.push(sep);
                    currentNumberResponse.push(`📦 <b>${escapeHTML(packageName)}</b>`);
                    currentNumberResponse.push(`⏰ <b>Aktif Hingga</b> : ${escapeHTML(expDate)}`);
                  }
                }
              } else {
                currentNumberResponse.push(sep);
                currentNumberResponse.push(`❗ <b>Info</b>: ${escapeHTML(cleanHasilText || this.defaultErrorInfo())}`);
              }
            }
          } else {
            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(number)}`);
            currentNumberResponse.push(sep);
            currentNumberResponse.push(this.defaultErrorInfo());
          }

          allResponses.push(`<blockquote>${currentNumberResponse.join('\n')}</blockquote>`);
        } catch (error) {
          console.error(`Error checking quota for ${number}:`, error);
          currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(number)}`);
          currentNumberResponse.push(sep);
          currentNumberResponse.push(`Terjadi kesalahan internal saat mencoba mengambil data kuota. Silakan coba lagi nanti.`);
          allResponses.push(`<blockquote>${currentNumberResponse.join('\n')}</blockquote>`);
        }
      }

      await this.sendMessage(chatId, allResponses.join('\n\n'), { parse_mode: 'HTML' });
      await this.deleteMessage(chatId, messageId);

    } else {
      return this.sendMessage(chatId,
        'Maaf, saya tidak mengerti. Silakan kirim nomor HP yang ingin Anda cek kuotanya (contoh: `081234567890`) atau ketik `/help` untuk bantuan.',
        { parse_mode: 'Markdown' });
    }
  }

  defaultErrorInfo() {
    return [
      `❗ <b>Info</b>:`,
      `Maaf, saat ini terjadi kendala dalam menampilkan detail info paket pada msisdn ini. Penyebabnya kemungkinan ini adalah sebagai berikut:`,
      `1. Silakan periksa nomor yang diinputkan dan pastikan masih aktif/sudah terdaftar.`,
      `2. Anda terlalu banyak melakukan pengecekan paket di fitur kami ini, coba lagi dalam 3 jam kedepan.`,
      `3. Sidompul sedang ada pemeliharaan sistem.`,
      `4. Coba kembali secara berkala.`
    ].join('\n');
  }
}
