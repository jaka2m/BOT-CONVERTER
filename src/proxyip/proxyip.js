const APIKU = 'https://api.checker-ip.web.id/check?ip=';
const DEFAULT_HOST = 'your.domain.com';
const sentMessages = new Map();

// UUID generator
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Emoji negara
export function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const codePoints = [...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

// Cek spam
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

// Command /proxyip
export async function handleProxyipCommand(bot, msg) {
  const chatId = msg.chat.id;
  if (!canSendMessage(chatId, 'proxyip_command')) return;

  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');

    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))].sort();
    const pageSize = 8;
    const page = 0;

    sendCountryButtons(bot, chatId, countryCodes, page);

  } catch (error) {
    await bot.sendMessage(chatId, `⚠️ *Gagal mengambil data: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

// Fungsi helper kirim tombol negara per halaman
async function sendCountryButtons(bot, chatId, countryCodes, page, messageId = null) {
  const pageSize = 8;
  const totalPages = Math.ceil(countryCodes.length / pageSize);
  const start = page * pageSize;
  const current = countryCodes.slice(start, start + pageSize);

  const buttons = [];
  for (let i = 0; i < current.length; i += 4) {
    buttons.push(
      current.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Prev', callback_data: `page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: '➡️ Next', callback_data: `page_${page + 1}` });

  if (navButtons.length) buttons.push(navButtons);
  buttons.push([{ text: '🔙 Back', callback_data: 'back_home' }]);

  if (messageId) {
    // Edit pesan yang sudah ada
    await bot.editMessageReplyMarkup({ inline_keyboard: buttons }, { chat_id: chatId, message_id: messageId });
  } else {
    // Kirim pesan baru
    await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }
}


// Callback handler
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  if (data.startsWith('page_')) {
    const page = parseInt(data.split('_')[1]);
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');
    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))].sort();

    // Edit pesan tombol, jangan kirim baru
    await sendCountryButtons(bot, chatId, countryCodes, page, messageId);

    // Jawab callback supaya loading berhenti
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, data)) return;

    const countryCode = data.split('_')[1];
    try {
      const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
      const ipText = await response.text();
      const ipList = ipText.split('\n').filter(line => line.trim() !== '');
      const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk ${countryCode}.*`, { parse_mode: 'Markdown' });
        return;
      }

      const randomProxy = filteredIPs[Math.floor(Math.random() * filteredIPs.length)];
      const [ip, port, , provider] = randomProxy.split(',');

      const ipData = await (await fetch(`${APIKU}${ip}:${port}`)).json();
      const status = ipData.status === "ACTIVE" ? "✅ ACTIVE" : "❌ DEAD";
      const provSafe = provider.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      const buttons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${provSafe}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${provSafe}` }
        ],
        [
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${provSafe}` }
        ],
        [
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${provSafe}` }
        ]
      ];

      let messageText = `✅ *IP ${getFlagEmoji(countryCode)} ${countryCode} :*\n\`\`\`\n` +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n\`\`\``;

      if (ipData.latitude && ipData.longitude) {
        messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }

      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });

    } catch (error) {
      await bot.sendMessage(chatId, `⚠️ *Gagal mendapatkan status IP.*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (data.startsWith('config_')) {
    if (!canSendMessage(chatId, data)) return;

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
        const vmessTLS = {
          v: "2", ps: `${countryCode} - ${prov1} [VMess-TLS]`, add: DEFAULT_HOST, port: "443", id: uuid1,
          aid: "0", net: "ws", type: "none", host: DEFAULT_HOST, path: pathh, tls: "tls", sni: DEFAULT_HOST, scy: "zero"
        };
        const vmessNTLS = { ...vmessTLS, port: "80", tls: "none", ps: `${countryCode} - ${prov1} [VMess-NTLS]` };
        configText = "``````VMESS-TLS\nvmess://" + toBase64(JSON.stringify(vmessTLS)) + "``````\n" +
                     "``````VMESS-NTLS\nvmess://" + toBase64(JSON.stringify(vmessNTLS)) + "``````";

      } else if (type === 'vless') {
        configText = `\`\`\`\`\`\`VLESS-TLS\nvless://${uuid}@${DEFAULT_HOST}:443?...#${prov}\n\`\`\`\`\`\`\n` +
                     `\`\`\`\`\`\`VLESS-NTLS\nvless://${uuid}@${DEFAULT_HOST}:80?...#${prov}\n\`\`\`\`\`\``;

      } else if (type === 'trojan') {
        configText = `\`\`\`\`\`\`TROJAN-TLS\ntrojan://${uuid}@${DEFAULT_HOST}:443?...#${prov}\n\`\`\`\`\`\`\n` +
                     `\`\`\`\`\`\`TROJAN-NTLS\ntrojan://${uuid}@${DEFAULT_HOST}:80?...#${prov}\n\`\`\`\`\`\``;

      } else if (type === 'ss') {
        configText = `\`\`\`\`\`\`SHADOWSOCKS-TLS\nss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:443?...#${prov}\n\`\`\`\`\`\`\n` +
                     `\`\`\`\`\`\`SHADOWSOCKS-NTLS\nss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:80?...#${prov}\n\`\`\`\`\`\``;
      }

      await bot.sendMessage(chatId, `✅ *Config ${type.toUpperCase()} ${getFlagEmoji(countryCode)}:*\n\`\`\`\n${configText}\n\`\`\``, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      await bot.sendMessage(chatId, `⚠️ *Gagal memproses konfigurasi.*`, { parse_mode: 'Markdown' });
    }
  }
}
