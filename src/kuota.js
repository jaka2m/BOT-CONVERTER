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
  function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Fungsi untuk mengirim aksi chat (misal: mengetik)
  async function sendChatAction(chatId, action) {
    try {
      await fetch(`${this.apiUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action })
      });
    } catch (err) {
      console.error('Gagal mengirim chat action:', err);
    }
  }

  // Fungsi untuk menghapus pesan
  async function deleteMessage(chatId, messageId) {
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

  async function handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id; // ID pesan yang diterima
    const text = message?.text?.trim() || '';
    const userId = message?.from?.id;
    const username = message?.from?.username;

    if (!chatId || !text) return;

    // Pesan /help tetap menggunakan Markdown
    if (text.startsWith('/help')) {
      return sendMessage(
        chatId,
        `
ℹ️ *Bantuan Bot*

• Kirim nomor HP untuk cek kuota.
• Format: 08xxxxxx atau beberapa nomor dipisahkan dengan spasi.
• Contoh: 082112345678 085612345678

Bot akan menampilkan informasi kuota dengan cepat dan mudah dibaca.
        `,
        'Markdown'
      );
    }

    const phoneNumbers = text
      .split(/\s+/)
      .filter(num => num.startsWith('08') && num.length >= 10 && num.length <= 14);

    if (phoneNumbers.length > 0) {
      // 1. Kirim indikator "mengetik"
      await sendChatAction(chatId, 'typing');

      let allResponses = [];
      const currentTime = new Date();
      const formattedCheckTime = formatDate(currentTime, 'full');

      for (const number of phoneNumbers) {
        const currentNumberResponse = [];
        const sep = "============================";

        currentNumberResponse.push(`🥷 <b>User</b> : ${escapeHTML(username || 'N/A')}`);
        currentNumberResponse.push(`🆔 <b>User ID</b> : ${escapeHTML(userId)}`);
        currentNumberResponse.push(`📆 <b>Waktu Pengecekan</b> : ${escapeHTML(formattedCheckTime)}`);
        currentNumberResponse.push(`═══════════════════════════`);

        try {
          const apiResponse = await checkQuota(number);

          if (
            apiResponse &&
            apiResponse.status === 'success' &&
            apiResponse.data &&
            apiResponse.data.data
          ) {
            const info = apiResponse.data.data;
            const {
              quotas,
              status_4g,
              dukcapil,
              grace_period,
              active_period,
              active_card,
              prefix
            } = info.data_sp;

            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(info.msisdn || '-')}`);
            currentNumberResponse.push(
              `📡 <b>Tipe Kartu</b> : ${escapeHTML(prefix?.value || '-')}`
            );
            currentNumberResponse.push(
              `📶 <b>Status Kartu</b> : ${escapeHTML(status_4g?.value || '-')}`
            );
            currentNumberResponse.push(
              `🪪 <b>Status Dukcapil</b> : ${escapeHTML(dukcapil?.value || '-')}`
            );
            currentNumberResponse.push(
              `🗓️ <b>Umur Kartu</b> : ${escapeHTML(active_card?.value || '-')}`
            );
            currentNumberResponse.push(
              `🚓 <b>Masa Aktif</b> : ${escapeHTML(
                formatDate(active_period?.value, 'dateOnly') || '-'
              )}`
            );
            currentNumberResponse.push(
              `🆘 <b>Akhir Tenggang</b> : ${escapeHTML(
                formatDate(grace_period?.value, 'dateOnly') || '-'
              )}`
            );

            if (Array.isArray(quotas?.value) && quotas.value.length > 0) {
              quotas.value.forEach(group => {
                if (!group.length) return;
                const pkg = group[0].packages;
                currentNumberResponse.push(sep);
                currentNumberResponse.push(`📦 <b>${escapeHTML(pkg?.name || '-')}</b>`);
                currentNumberResponse.push(
                  `⏰ <b>Aktif Hingga</b> : ${escapeHTML(formatDate(pkg?.expDate, 'full'))}`
                );
                group[0].benefits?.forEach(b => {
                  currentNumberResponse.push(`  🌀 <b>Benefit</b> : ${escapeHTML(b.bname || '-')}`);
                  currentNumberResponse.push(`  🧢 <b>Tipe Kuota</b>: ${escapeHTML(b.type || '-')}`);
                  currentNumberResponse.push(`  🎁 <b>Kuota</b> : ${escapeHTML(b.quota || '-')}`);
                  currentNumberResponse.push(`  ⏳ <b>Sisa</b> : ${escapeHTML(b.remaining || '-')}`);
                });
              });
            } else {
              const rawHasilText = info.hasil || '';
              const isErrorMessageInHasil = rawHasilText.includes(
                "Maaf, saat ini terjadi kendala dalam menampilkan detail info paket"
              );

              if (!isErrorMessageInHasil) {
                const cleanHasilText = rawHasilText
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]+>/g, '')
                  .replace(/=/g, '')
                  .replace(/📃 RESULT: \s*\n\n/g, '')
                  .trim();

                if (cleanHasilText.includes("🎁 Quota:")) {
                  const quotaSections = cleanHasilText.split('🎁 Quota:');
                  for (let i = 1; i < quotaSections.length; i++) {
                    const quotaDetail = quotaSections[i].trim();
                    const lines = quotaDetail.split('\n').filter(line => line.trim() !== '');

                    const packageName = lines[0]?.trim();
                    const expDateLine = lines.find(line =>
                      line.startsWith('🍂 Aktif Hingga:')
                    );
                    const expDate = expDateLine
                      ? expDateLine.replace('🍂 Aktif Hingga:', '').trim()
                      : null;

                    if (packageName && expDate) {
                      currentNumberResponse.push(sep);
                      currentNumberResponse.push(`📦 <b>${escapeHTML(packageName)}</b>`);
                      currentNumberResponse.push(
                        `⏰ <b>Aktif Hingga</b> : ${escapeHTML(expDate)}`
                      );
                    }
                  }
                } else if (cleanHasilText) {
                  currentNumberResponse.push(sep);
                  currentNumberResponse.push(`❗ <b>Info</b>: ${escapeHTML(cleanHasilText)}`);
                } else {
                  currentNumberResponse.push(sep);
                  currentNumberResponse.push(`❗ <b>Info</b>: `);
                  currentNumberResponse.push(
                    `Maaf, saat ini terjadi kendala dalam menampilkan detail info paket pada msisdn ini. Penyebabnya kemungkinan ini adalah sebagai berikut:`
                  );
                  currentNumberResponse.push(
                    `1. Silakan periksa nomor yang diinputkan dan pastikan masih aktif/sudah terdaftar.`
                  );
                  currentNumberResponse.push(
                    `2. Anda terlalu banyak melakukan pengecekan paket di fitur kami ini, coba lagi dalam 3 jam kedepan.`
                  );
                  currentNumberResponse.push(`3. Sidompul sedang ada pemeliharaan sistem.`);
                  currentNumberResponse.push(`4. Coba kembali secara berkala.`);
                }
              } else {
                currentNumberResponse.push(sep);
                currentNumberResponse.push(`❗ <b>Info</b>: `);
                currentNumberResponse.push(
                  `Maaf, saat ini terjadi kendala dalam menampilkan detail info paket pada msisdn ini. Penyebabnya kemungkinan ini adalah sebagai berikut:`
                );
                currentNumberResponse.push(
                  `1. Silakan periksa nomor yang diinputkan dan pastikan masih aktif/sudah terdaftar.`
                );
                currentNumberResponse.push(
                  `2. Anda terlalu banyak melakukan pengecekan paket di fitur kami ini, coba lagi dalam 3 jam kedepan.`
                );
                currentNumberResponse.push(`3. Sidompul sedang ada pemeliharaan sistem.`);
                currentNumberResponse.push(`4. Coba kembali secara berkala.`);
              }
            }
          } else {
            currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(number)}`);
            currentNumberResponse.push(sep);
            currentNumberResponse.push(`❗ <b>Info</b>: `);
            currentNumberResponse.push(
              `Maaf, saat ini terjadi kendala dalam menampilkan detail info paket pada msisdn ini. Penyebabnya kemungkinan ini adalah sebagai berikut:`
            );
            currentNumberResponse.push(
              `1. Silakan periksa nomor yang diinputkan dan pastikan masih aktif/sudah terdaftar.`
            );
            currentNumberResponse.push(
              `2. Anda terlalu banyak melakukan pengecekan paket di fitur kami ini, coba lagi dalam 3 jam kedepan.`
            );
            currentNumberResponse.push(`3. Sidompul sedang ada pemeliharaan sistem.`);
            currentNumberResponse.push(`4. Coba kembali secara berkala.`);
          }

          allResponses.push(`<blockquote>${currentNumberResponse.join('\n')}</blockquote>`);
        } catch (error) {
          console.error(`Error checking quota for ${number}:`, error);
          currentNumberResponse.push(`☎️ <b>Nomor</b> : ${escapeHTML(number)}`);
          currentNumberResponse.push(sep);
          currentNumberResponse.push(
            `Terjadi kesalahan internal saat mencoba mengambil data kuota. Silakan coba lagi nanti.`
          );
          allResponses.push(`<blockquote>${currentNumberResponse.join('\n')}</blockquote>`);
        }
      }

      // 2. Kirim balasan utama
      await sendMessage(chatId, allResponses.join('\n\n'), 'HTML');

      // 3. Hapus pesan yang dikirim pengguna (opsional, jika ingin "auto delete proses selesai")
      // Ini akan menghapus pesan yang dikirim pengguna setelah bot membalas.
      await deleteMessage(chatId, messageId);
    } else {
      return sendMessage(
        chatId,
        'Maaf, saya tidak mengerti. Silakan kirim nomor HP yang ingin Anda cek kuotanya (contoh: `081234567890`) atau ketik `/help` untuk bantuan.',
        'Markdown'
      );
    }
  }

  async function checkQuota(msisdn) {
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

  function formatDate(dateInput, type = 'full') {
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
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    if (type === 'dateOnly') {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  function pad(n) {
    return n < 10 ? '0' + n : n;
  }

  async function sendMessage(chatId, text, parseMode = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(parseMode === 'Markdown' ? { parse_mode: "Markdown" } : {}),
      ...(parseMode === 'HTML' ? { parse_mode: "HTML" } : {})
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
