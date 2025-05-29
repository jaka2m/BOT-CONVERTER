const APIKU = 'https://api.checker-ip.web.id/check?ip='; // Ganti dengan URL asli API status IP
const DEFAULT_HOST = 'your.domain.com'; // Ganti dengan host default

// Simpan pesan yang sudah dikirim ke user (chatId) supaya tidak spam
const sentMessages = new Map();

// Simpan paging negara per chatId
const countryPages = new Map();

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

const PAGE_SIZE = 16; // 4 kolom * 4 baris

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
    countryPages.set(chatId, { countryCodes, page: 0 }); // Simpan negara dan halaman awal

    // Kirim tombol negara halaman 1
    await sendCountryPage(bot, chatId, 0);

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

async function sendCountryPage(bot, chatId, page) {
  const { countryCodes } = countryPages.get(chatId);
  const totalPages = Math.ceil(countryCodes.length / PAGE_SIZE);

  // Batasi page antara 0 dan totalPages-1
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  countryPages.set(chatId, { countryCodes, page });

  // Ambil negara sesuai page
  const start = page * PAGE_SIZE;
  const pageCountries = countryCodes.slice(start, start + PAGE_SIZE);

  // Buat tombol 4 kolom x 4 baris
  const buttons = [];
  for (let i = 0; i < pageCountries.length; i += 4) {
    buttons.push(
      pageCountries.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  // Tambah tombol Prev & Next di bawah tombol negara jika ada lebih dari 1 halaman
  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: '⬅️ Prev', callback_data: 'country_prev' });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: 'country_next' });
  }
  if (navButtons.length > 0) buttons.push(navButtons);

  await bot.sendMessage(chatId, `🌍 *Pilih negara (Halaman ${page + 1}/${totalPages}):*`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'country_prev' || data === 'country_next') {
    // Navigasi halaman negara
    if (!countryPages.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tidak ada data negara.' });
      return;
    }

    let { countryCodes, page } = countryPages.get(chatId);
    if (data === 'country_prev') page = Math.max(0, page - 1);
    else if (data === 'country_next') page = Math.min(Math.ceil(countryCodes.length / PAGE_SIZE) - 1, page + 1);

    countryPages.set(chatId, { countryCodes, page });
    await sendCountryPage(bot, chatId, page);
    await bot.answerCallbackQuery(callbackQuery.id);
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

      // Tombol protokol di bawah info IP
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
        ],
        [
          { text: '⬅️ Kembali ke negara', callback_data: 'back_to_countries' }
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

    } catch (error) {
      console.error('❌ Error fetching IP status:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memverifikasi IP.*`, { parse_mode: 'Markdown' });
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
        configText = `\`\`\`\`\`\`SHADOWSOCKS
ss://${toBase64(`aes-256-gcm:${uuid}@${DEFAULT_HOST}:443?plugin=obfs-local;obfs=http;obfs-host=${DEFAULT_HOST}`)}#${prov}
\`\`\`\`\`\``;
      }

      // Tombol Back di bawah config
      const backButton = [[{ text: '⬅️ Kembali ke negara', callback_data: 'back_to_countries' }]];

      await bot.sendMessage(chatId, configText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: backButton }
      });

    } catch (error) {
      console.error('❌ Error generating config:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat membuat konfigurasi.*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (data === 'back_to_countries') {
    if (!countryPages.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tidak ada data negara untuk kembali.' });
      return;
    }
    const { page } = countryPages.get(chatId);
    await sendCountryPage(bot, chatId, page);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  // Jika callback tidak ter-handle, jawab supaya loading stop
  await bot.answerCallbackQuery(callbackQuery.id);
}
