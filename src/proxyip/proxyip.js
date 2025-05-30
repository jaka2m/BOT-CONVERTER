const APIKU = 'https://api.checker-ip.web.id/check?ip='; // Ganti dengan URL asli API status IP
const DEFAULT_HOST = 'your.domain.com'; // Ganti dengan host default

const sentMessages = new Map();

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

function chunkArray(arr, size) {
  const result = [];
  for(let i=0; i < arr.length; i+=size) {
    result.push(arr.slice(i, i+size));
  }
  return result;
}

function buildProxyTypeButtons(ip, port, countryCode, provider) {
  // Buat 12 tombol max (3 kolom x 4 baris)
  const types = ['vless', 'trojan', 'vmess', 'ss'];
  const labels = {
    vless: '⚡ VLESS',
    trojan: '⚡ TROJAN',
    vmess: '⚡ VMESS',
    ss: '⚡ SHADOWSOCKS'
  };

  // Buat array tombol objek
  const btns = types.map(type => ({
    text: labels[type],
    callback_data: `config_${type}_${ip}_${port}_${countryCode}_${provider}`
  }));

  // Susun tombol jadi 3 kolom per baris (1 baris 3 tombol)
  const btnRows = chunkArray(btns, 3);

  return btnRows;
}

function buildPaginationButtons(page, totalPages) {
  const buttons = [];
  if (page > 1) {
    buttons.push({ text: '⬅️ Prev', callback_data: `page_${page-1}` });
  }
  if (page < totalPages) {
    buttons.push({ text: 'Next ➡️', callback_data: `page_${page+1}` });
  }
  buttons.push({ text: '🔙 Back', callback_data: 'back_to_countries' });
  // Ini 1 baris tombol pagination di bawah tombol tipe proxy
  return [buttons];
}

let userPaginationData = new Map(); // Simpan data pagination per chat

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

    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))];

    // Simpan data negara utk pagination (jika mau dipakai nanti)
    userPaginationData.set(chatId, { countryCodes, ipList });

    // Kirim daftar negara (1 baris 3 tombol, 4 baris = max 12 tombol)
    const btnRows = chunkArray(countryCodes.map(code => ({
      text: `${getFlagEmoji(code)} ${code}`,
      callback_data: `select_${code}`
    })), 3);

    await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: btnRows }
    });

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const msgId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  // Fungsi hapus pesan tertentu jika ada, untuk hapus tombol lama / spam
  async function tryDeleteMessage(id) {
    try {
      await bot.deleteMessage(chatId, id);
    } catch(e) {
      // abaikan error hapus pesan
    }
  }

  // Hapus tombol lama / loading yang bisa jadi spam
  async function clearPreviousPagination() {
    const userData = userPaginationData.get(chatId);
    if (userData && userData.lastPaginationMsgId) {
      if (userData.lastPaginationMsgId !== msgId) {
        await tryDeleteMessage(userData.lastPaginationMsgId);
      }
    }
  }

  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, `select_${data}`)) return;

    const countryCode = data.split('_')[1];

    try {
      const userData = userPaginationData.get(chatId);
      if (!userData) {
        await bot.sendMessage(chatId, '⚠️ *Data tidak ditemukan, silahkan ulangi perintah.*', { parse_mode: 'Markdown' });
        return;
      }

      // Filter IP sesuai negara
      const filteredIPs = userData.ipList.filter(line => line.split(',')[2] === countryCode);

      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk negara ${countryCode}.*`, { parse_mode: 'Markdown' });
        return;
      }

      // Simpan filtered IP utk pagination
      userPaginationData.set(chatId, {
        ...userData,
        filteredIPs,
        currentPage: 1,
        pageSize: 1,
        countryCode,
      });

      // Tampilkan halaman 1
      await sendProxyPage(bot, chatId, 1);

    } catch (error) {
      console.error('❌ Error fetching IP status:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memproses IP.*`, { parse_mode: 'Markdown' });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith('page_')) {
    const pageNum = parseInt(data.split('_')[1]);
    if (isNaN(pageNum)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Halaman tidak valid' });
      return;
    }
    await clearPreviousPagination();

    await sendProxyPage(bot, chatId, pageNum, msgId);

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === 'back_to_countries') {
    await clearPreviousPagination();

    // Kirim ulang daftar negara
    const userData = userPaginationData.get(chatId);
    if (!userData) {
      await bot.sendMessage(chatId, '⚠️ *Data tidak ditemukan, silahkan ulangi perintah.*', { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    const countryCodes = userData.countryCodes;
    const btnRows = chunkArray(countryCodes.map(code => ({
      text: `${getFlagEmoji(code)} ${code}`,
      callback_data: `select_${code}`
    })), 3);

    const sentMsg = await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: btnRows }
    });

    // Update pagination data agar hapus pesan lama berjalan
    userPaginationData.set(chatId, {
      ...userData,
      lastPaginationMsgId: sentMsg.message_id,
      filteredIPs: null,
      currentPage: null,
      countryCode: null
    });

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith('config_')) {
    if (!canSendMessage(chatId, `config_${data}`)) return;

    try {
      const [_, type, ip, port, countryCode, provider] = data.split('_');
      const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';
      const uuid = generateUUID();

      const path = encodeURIComponent(`/Geo-Project/${ip}=${port}`);
      const pathh = `/Geo-Project/${ip}-${port}`;
      const prov = encodeURIComponent(`${provider} ${getFlagEmoji(countryCode)}`);
      const prov1 = `${provider} ${getFlagEmoji(countryCode)}`;
      const toBase64 = (str) => Buffer.from(str).toString('base64');

      let configText = '';

      if (type === 'vmess') {
        const vmessJSON_TLS = {
          v: "2",
          ps: `${countryCode} - ${prov1} [VMess-TLS]`,
          add: DEFAULT_HOST,
          port: "443",
          id: uuid1,
          aid: "0",
          net: "ws",
          type: "none",
          host: DEFAULT_HOST,
          path: pathh,
          tls: "tls",
          sni: DEFAULT_HOST,
          scy: "zero"
        };

        const vmessJSON_NTLS = {
          ...vmessJSON_TLS,
          port: "80",
          tls: "none",
          ps: `${countryCode} - ${prov1} [VMess-NTLS]`
        };

        configText = "``````VMESS-TLS\nvmess://" + toBase64(JSON.stringify(vmessJSON_TLS)) + "``````\n" +
          "``````VMESS-NTLS\nvmess://" + toBase64(JSON.stringify(vmessJSON_NTLS)) + "``````";

      } else if (type === 'vless') {
        configText = `\`\`\`\`\`\`VLESS-TLS
vless://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`VLESS-NTLS
vless://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else if (type === 'trojan') {
        configText = `\`\`\`\`\`\`TROJAN-TLS
trojan://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`TROJAN-NTLS
trojan://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else if (type === 'ss') {
        configText = `\`\`\`\`\`\`SHADOWSOCKS
ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpVbndhYWhpQDMuMjAuMjMuMTA6MTIzNDU=#${prov}
\`\`\`\`\`\``;
      } else {
        configText = "⚠️ Tipe proxy tidak dikenali.";
      }

      await bot.sendMessage(chatId, configText, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, '⚠️ Terjadi kesalahan saat membuat konfigurasi.');
    }

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id);
}

async function sendProxyPage(bot, chatId, page, prevMsgId) {
  const userData = userPaginationData.get(chatId);
  if (!userData || !userData.filteredIPs) {
    await bot.sendMessage(chatId, '⚠️ *Data tidak ditemukan, silahkan ulangi perintah.*', { parse_mode: 'Markdown' });
    return;
  }

  const pageSize = userData.pageSize;
  const totalPages = Math.ceil(userData.filteredIPs.length / pageSize);
  if (page < 1 || page > totalPages) {
    await bot.sendMessage(chatId, `⚠️ *Halaman tidak valid.*`, { parse_mode: 'Markdown' });
    return;
  }

  const ipLine = userData.filteredIPs[(page - 1) * pageSize];
  const [ip, port, countryCode, provider] = ipLine.split(',');

  // Cek status IP via API (optional, bisa di-disable kalau berat)
  let statusText = '⚠️ Status tidak diketahui';
  try {
    const res = await fetch(APIKU + ip);
    const json = await res.json();
    if (json.status === 'success') {
      statusText = `✅ IP ${ip}:${port} Online\n📍 ${json.city}, ${json.country}\n🏢 ISP: ${json.isp}`;
    } else {
      statusText = `❌ IP ${ip}:${port} Offline atau tidak terjangkau`;
    }
  } catch {
    statusText = `⚠️ Gagal memeriksa status IP`;
  }

  // Buat tombol proxy tipe
  const btnProxyTypes = buildProxyTypeButtons(ip, port, countryCode, provider);

  // Buat tombol pagination
  const btnPagination = buildPaginationButtons(page, totalPages);

  const allButtons = [...btnProxyTypes, ...btnPagination];

  // Jika ada pesan lama pagination, hapus supaya gak spam
  if (prevMsgId) {
    try {
      await bot.editMessageText(`${statusText}\n\nHalaman ${page} dari ${totalPages}`, {
        chat_id: chatId,
        message_id: prevMsgId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: allButtons }
      });
    } catch (e) {
      // Kalau gagal edit, coba kirim baru
      const sentMsg = await bot.sendMessage(chatId, `${statusText}\n\nHalaman ${page} dari ${totalPages}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: allButtons }
      });
      userPaginationData.set(chatId, { ...userData, lastPaginationMsgId: sentMsg.message_id, currentPage: page });
    }
  } else {
    // Kirim pesan baru
    const sentMsg = await bot.sendMessage(chatId, `${statusText}\n\nHalaman ${page} dari ${totalPages}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: allButtons }
    });
    userPaginationData.set(chatId, { ...userData, lastPaginationMsgId: sentMsg.message_id, currentPage: page });
  }
}
