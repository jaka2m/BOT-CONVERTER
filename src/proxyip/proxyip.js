const APIKU = 'https://api.checker-ip.web.id/check?ip='; // Ganti dengan URL asli API status IP
const DEFAULT_HOST = 'your.domain.com'; // Ganti dengan host default

// Simpan pesan yang sudah dikirim ke user (chatId) supaya tidak spam
const sentMessages = new Map();

// Simpan messageId pagination agar bisa dihapus saat pindah page
const paginationMessage = new Map();

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0,
      v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const codePoints = [...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

export function canSendMessage(chatId, key, interval = 30000) {
  const now = Date.now();
  if (!sentMessages.has(chatId)) sentMessages.set(chatId, {});
  const userData = sentMessages.get(chatId);
  if (!userData[key] || now - userData[key] > interval) {
    userData[key] = now;
    return true;
  }
  return false;
}

// Handle command /proxyip
export async function handleProxyipCommand(bot, msg) {
  const chatId = msg.chat.id;
  if (!canSendMessage(chatId, 'proxyip_command')) return;

  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');

    if (ipList.length === 0) {
      await bot.sendMessage(chatId, `⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*`, { parse_mode: 'Markdown' });
      return;
    }

    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))].sort();

    // Paginasi 4x4 tombol (16 negara per halaman)
    const pageSize = 16;
    const page = 0;

    await sendCountryPage(bot, chatId, countryCodes, page, pageSize);

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(msg.chat.id, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

// Fungsi kirim tombol negara dengan paginasi
async function sendCountryPage(bot, chatId, countryCodes, page, pageSize) {
  // Hitung slice data
  const totalPages = Math.ceil(countryCodes.length / pageSize);
  const pageItems = countryCodes.slice(page * pageSize, (page + 1) * pageSize);

  // Tombol 4 per baris, maksimal 4 baris
  const buttons = [];
  for (let i = 0; i < pageItems.length; i += 4) {
    buttons.push(
      pageItems.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  // Tambahkan tombol navigasi di bawah tombol negara
  const navButtons = [];

  if (page > 0) {
    navButtons.push({ text: '⬅️ Prev', callback_data: `page_${page - 1}` });
  }

  if (page < totalPages - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
  }

  if (navButtons.length) buttons.push(navButtons);

  // Jika ada pesan paginasi sebelumnya, hapus dulu supaya gak spam tombol
  if (paginationMessage.has(chatId)) {
    try {
      await bot.deleteMessage(chatId, paginationMessage.get(chatId));
    } catch { /* ignore if message already deleted */ }
  }

  const sentMsg = await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });

  paginationMessage.set(chatId, sentMsg.message_id);
}

// Handler callback query
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Handle pagination tombol negara
  if (data.startsWith('page_')) {
    if (!canSendMessage(chatId, `page_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    try {
      const page = parseInt(data.split('_')[1], 10);
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))].sort();

      await sendCountryPage(bot, chatId, countryCodes, page, 16);
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error pagination:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal memuat halaman.' });
    }
    return;
  }

  // Handle pilih negara
  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, `select_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    const countryCode = data.split('_')[1];
    try {
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk negara ${countryCode}.*`, { parse_mode: 'Markdown' });
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
      }

      const randomProxy = filteredIPs[Math.floor(Math.random() * filteredIPs.length)];
      const [ip, port, , provider] = randomProxy.split(',');

      const statusResponse = await fetch(`${APIKU}${ip}:${port}`);
      const ipData = await statusResponse.json();
      const status = ipData.status === "ACTIVE" ? "✅ ACTIVE" : "❌ DEAD";

      const safeProvider = provider.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      // Tombol protokol 1 baris 4 tombol
      const buttons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⬅️ Prev', callback_data: `select_prev_${countryCode}_${ip}_${port}_${safeProvider}` },
          { text: 'Back 🔙', callback_data: 'back_to_countries' },
          { text: 'Next ➡️', callback_data: `select_next_${countryCode}_${ip}_${port}_${safeProvider}` }
        ]
      ];

      let messageText = `✅ *Info IP untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```\nINFORMATION\n" +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n` +
        "```";

      if (ipData.latitude && ipData.longitude) {
        messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }

      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });

      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('❌ Error fetching IP status:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memverifikasi IP.*`, { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    return;
  }

  // Handle tombol Prev/Next dalam pilihan proxy (bisa implementasi sederhana pindah proxy lain)
  if (data.startsWith('select_prev_') || data.startsWith('select_next_')) {
    if (!canSendMessage(chatId, data)) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    try {
      const parts = data.split('_');
      const action = parts[1]; // prev or next
      const countryCode = parts[2];
      let currentIp = parts[3];
      let currentPort = parts[4];
      let provider = parts.slice(5).join('_');

      // Ambil proxy list untuk negara ini
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

      // Cari index current proxy
      const currentIndex = filteredIPs.findIndex(line => {
        const [ip, port] = line.split(',');
        return ip === currentIp && port === currentPort;
      });

      if (currentIndex === -1) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Proxy tidak ditemukan' });
        return;
      }

      let newIndex = currentIndex;
      if (action === 'prev') {
        newIndex = (currentIndex === 0) ? filteredIPs.length - 1 : currentIndex - 1;
      } else {
        newIndex = (currentIndex === filteredIPs.length - 1) ? 0 : currentIndex + 1;
      }

      const newProxy = filteredIPs[newIndex];
      const [ip, port, , providerNew] = newProxy.split(',');

      // Panggil ulang info proxy dan tombol config sama tombol navigasi Prev/Next/Back
      const statusResponse = await fetch(`${APIKU}${ip}:${port}`);
      const ipData = await statusResponse.json();
      const status = ipData.status === "ACTIVE" ? "✅ ACTIVE" : "❌ DEAD";

      const safeProvider = providerNew.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      const buttons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⬅️ Prev', callback_data: `select_prev_${countryCode}_${ip}_${port}_${safeProvider}` },
          { text: 'Back 🔙', callback_data: 'back_to_countries' },
          { text: 'Next ➡️', callback_data: `select_next_${countryCode}_${ip}_${port}_${safeProvider}` }
        ]
      ];

      let messageText = `✅ *Info IP untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```\nINFORMATION\n" +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${providerNew}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n` +
        "```";

      if (ipData.latitude && ipData.longitude) {
        messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }

      // Edit pesan callback agar tombol navigasi tetap rapi dan tanpa spam
      try {
        await bot.editMessageText(messageText, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch {
        // fallback send new message jika edit gagal
        await bot.sendMessage(chatId, messageText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
        await bot.answerCallbackQuery(callbackQuery.id);
      }

    } catch (error) {
      console.error('❌ Error Prev/Next:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal memuat proxy berikutnya.' });
    }
    return;
  }

  // Handle tombol Back
  if (data === 'back_to_countries') {
    try {
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))].sort();

      // Kirim halaman 0 negara lagi
      await sendCountryPage(bot, chatId, countryCodes, 0, 16);

      // Hapus pesan lama jika ada
      try {
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);
      } catch {}

      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('❌ Error Back:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal kembali ke negara.' });
    }
    return;
  }

  // TODO: Handle tombol config_vless, config_trojan, config_vmess, config_ss jika mau bikin config

  await bot.answerCallbackQuery(callbackQuery.id);
}
