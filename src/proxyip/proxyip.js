const APIKU = 'https://api.checker-ip.web.id/check?ip='; // Ganti dengan URL asli API status IP
const DEFAULT_HOST = 'your.domain.com'; // Ganti dengan host default

// Simpan pesan yang sudah dikirim ke user (chatId) supaya tidak spam
const sentMessages = new Map();

// Pagination state per user chatId
const paginationStates = new Map();

// Fungsi untuk generate UUID (simple version)
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

// Fungsi untuk mencegah spam pesan berulang
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

// Handler command /proxyip
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

    // Simpan pagination state user
    paginationStates.set(chatId, { countryCodes, page: 0 });

    // Kirim page pertama
    await sendCountryPage(bot, chatId, countryCodes, 0);

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

async function sendCountryPage(bot, chatId, countryCodes, page) {
  const perPage = 16; // 4x4 tombol
  const totalPages = Math.ceil(countryCodes.length / perPage);
  const start = page * perPage;
  const end = start + perPage;

  const pageItems = countryCodes.slice(start, end);

  // Generate tombol 4 per baris
  const countryButtons = [];
  for (let i = 0; i < pageItems.length; i += 4) {
    countryButtons.push(
      pageItems.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  // Tombol Prev, Next, Back di bawah tombol negara
  const navButtons = [];

  if (page > 0) {
    navButtons.push({ text: '⬅️ Prev', callback_data: `page_${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
  }

  // Tombol Back (kembali ke protokol)
  navButtons.push({ text: '🔙 Back', callback_data: 'back_to_protocols' });

  // Tombol protokol tetap di atas
  const protocolButtons = [
    [
      { text: '⚡ VLESS', callback_data: 'protocol_vless' },
      { text: '⚡ TROJAN', callback_data: 'protocol_trojan' },
      { text: '⚡ VMESS', callback_data: 'protocol_vmess' },
      { text: '⚡ SHADOWSOCKS', callback_data: 'protocol_ss' }
    ]
  ];

  // Gabungkan tombol protokol + tombol negara + tombol navigasi
  const keyboard = [
    ...protocolButtons,
    ...countryButtons,
    navButtons
  ];

  // Hapus pesan lama jika ada untuk mencegah spam tombol
  if (paginationStates.has(chatId) && paginationStates.get(chatId).messageId) {
    try {
      await bot.deleteMessage(chatId, paginationStates.get(chatId).messageId);
    } catch {
      // abaikan error kalau sudah dihapus
    }
  }

  const sentMsg = await bot.sendMessage(chatId, `🌍 *Pilih negara:* (Halaman ${page + 1}/${totalPages})`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });

  // Simpan messageId supaya bisa dihapus saat pagination berubah
  paginationStates.set(chatId, {
    ...paginationStates.get(chatId),
    page,
    messageId: sentMsg.message_id
  });
}

// Handler callback query
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Handle pagination tombol negara
  if (data.startsWith('page_')) {
    if (!canSendMessage(chatId, `page_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tunggu sebentar...' });
      return;
    }
    const page = parseInt(data.split('_')[1]);
    const state = paginationStates.get(chatId);
    if (!state) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'State pagination hilang. Ketik /proxyip ulang.' });
      return;
    }
    await sendCountryPage(bot, chatId, state.countryCodes, page);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === 'back_to_protocols') {
    // Kembali ke tampilan protokol saja, tanpa tombol negara
    const protocolButtons = [
      [
        { text: '⚡ VLESS', callback_data: 'protocol_vless' },
        { text: '⚡ TROJAN', callback_data: 'protocol_trojan' },
        { text: '⚡ VMESS', callback_data: 'protocol_vmess' },
        { text: '⚡ SHADOWSOCKS', callback_data: 'protocol_ss' }
      ]
    ];

    // Hapus pesan lama kalau ada
    if (paginationStates.has(chatId) && paginationStates.get(chatId).messageId) {
      try {
        await bot.deleteMessage(chatId, paginationStates.get(chatId).messageId);
      } catch {}
    }

    const sentMsg = await bot.sendMessage(chatId, '⚡ *Pilih protokol:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: protocolButtons }
    });

    paginationStates.delete(chatId);
    // Save message id supaya bisa dihapus saat paging nanti
    paginationStates.set(chatId, { messageId: sentMsg.message_id });
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  // Protokol dipilih -> tampil IP random sesuai protokol & country jika sudah dipilih
  if (data.startsWith('protocol_')) {
    const proto = data.split('_')[1];
    // Simpan protokol di paginationState untuk digunakan di select country
    let state = paginationStates.get(chatId) || {};
    state.selectedProtocol = proto;
    paginationStates.set(chatId, state);

    // Langsung tampilkan tombol negara, halaman pertama
    if (state.countryCodes && state.countryCodes.length > 0) {
      await sendCountryPage(bot, chatId, state.countryCodes, 0);
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    } else {
      // Kalau belum ada countryCodes, minta ketik /proxyip dulu
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ketik dulu /proxyip untuk memuat daftar negara' });
      return;
    }
  }

  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, `select_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tunggu sebentar...' });
      return;
    }

    const countryCode = data.split('_')[1];
    let state = paginationStates.get(chatId);
    const proto = state?.selectedProtocol;

    if (!proto) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Pilih protokol dulu' });
      return;
    }

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

      const buttons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ]
      ];

      let messageText = `✅ *Info IP untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```\nINFORMATION\n" +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n` +
        "```";

      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error(err);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error saat mengambil data proxy' });
    }
    return;
  }

  // Tangani tombol config protocol (VLESS, TROJAN, VMESS, SS)
  if (data.startsWith('config_')) {
    // Contoh: config_vless_1.2.3.4_443_ID_ISP
    const parts = data.split('_');
    if (parts.length < 6) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Data konfigurasi tidak valid' });
      return;
    }
    const proto = parts[1];
    const ip = parts[2];
    const port = parts[3];
    const countryCode = parts[4];
    const provider = parts.slice(5).join('_');

    // Kirim konfigurasi (contoh sederhana)
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
        configText = `\`\`\`\`\`\`SHADOWSOCKS-TLS
ss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:443?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=tls&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`SHADOWSOCKS-NTLS
ss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:80?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=none&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Protokol tidak dikenali." });
        return;
      }

      const infoText = `✅ *Konfigurasi ${type.toUpperCase()} untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```" + configText + "```";

      await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('Error generating config:', error);
      await bot.sendMessage(chatId, `⚠️ *Gagal membuat konfigurasi: ${error.message}*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id);
}
