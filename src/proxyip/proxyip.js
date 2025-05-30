const APIKU = 'https://api.checker-ip.web.id/check?ip=';
const DEFAULT_HOST = 'your.domain.com';

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

const PAGE_SIZE = 16; // 4x4 grid

// Simpan halaman saat user pilih negara untuk paging tombol
const userPages = new Map();

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

    // Simpan negara di userPages page 0
    userPages.set(chatId, { countryCodes, page: 0 });

    const keyboard = buildCountryKeyboard(countryCodes, 0);

    await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

function buildCountryKeyboard(countryCodes, page) {
  const start = page * PAGE_SIZE;
  const slice = countryCodes.slice(start, start + PAGE_SIZE);

  // 4 tombol per baris
  const rows = [];
  for (let i = 0; i < slice.length; i += 4) {
    rows.push(
      slice.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  // Tombol Prev Next jika perlu
  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: '⬅️ Prev', callback_data: `page_prev` });
  }
  if ((page + 1) * PAGE_SIZE < countryCodes.length) {
    navButtons.push({ text: 'Next ➡️', callback_data: `page_next` });
  }
  if (navButtons.length) rows.push(navButtons);

  return rows;
}

export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'page_prev' || data === 'page_next') {
    // Pagination tombol negara
    if (!userPages.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tidak ada halaman aktif.' });
      return;
    }
    const pageData = userPages.get(chatId);
    let newPage = pageData.page + (data === 'page_next' ? 1 : -1);
    if (newPage < 0) newPage = 0;
    if (newPage > Math.floor(pageData.countryCodes.length / PAGE_SIZE)) newPage = pageData.page; // batas max

    userPages.set(chatId, { ...pageData, page: newPage });

    // Edit pesan dengan keyboard baru (pagination tombol negara)
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: buildCountryKeyboard(pageData.countryCodes, newPage) },
        { chat_id: chatId, message_id: callbackQuery.message.message_id }
      );
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error saat pagination:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal memperbarui halaman.' });
    }
    return;
  }

  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, `select_${data}`)) return;

    const countryCode = data.split('_')[1];
    try {
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk negara ${countryCode}.*`, { parse_mode: 'Markdown' });
        return;
      }

      const randomProxy = filteredIPs[Math.floor(Math.random() * filteredIPs.length)];
      const [ip, port, , provider] = randomProxy.split(',');

      const statusResponse = await fetch(`${APIKU}${ip}:${port}`);
      const ipData = await statusResponse.json();
      const status = ipData.status === "ACTIVE" ? "✅ ACTIVE" : "❌ DEAD";

      const safeProvider = provider.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      // Tombol protokol
      const protocolButtons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        // Tombol navigasi dibawah tombol protokol
        [
          { text: '⬅️ Prev', callback_data: `page_prev` },
          { text: 'Next ➡️', callback_data: `page_next` },
          { text: '🔙 Back', callback_data: `back_to_countries` }
        ]
      ];

      let messageText = `✅ *Info IP untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```\nINFORMATION\n" +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n` +
        "```";

      if (ipData.latitude && ipData.longitude) {
        messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }

      await bot.editMessageText(messageText, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: protocolButtons }
      });

      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('❌ Error fetching IP status:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memverifikasi IP.*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (data === 'back_to_countries') {
    if (!userPages.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tidak ada halaman negara aktif.' });
      return;
    }
    const pageData = userPages.get(chatId);
    try {
      await bot.editMessageText('🌍 *Pilih negara:*', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildCountryKeyboard(pageData.countryCodes, pageData.page) }
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error back to countries:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal kembali ke daftar negara.' });
    }
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
