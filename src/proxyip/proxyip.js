const APIKU = 'https://api.checker-ip.web.id/check?ip=';
const DEFAULT_HOST = 'your.domain.com';

const sentMessages = new Map();
const PAGE_SIZE = 16; // 4x4 grid
const userPages = new Map(); // Simpan halaman saat user pilih negara untuk paging tombol

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
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

export async function handleProxyipCommand(bot, msg) {
  const chatId = msg.chat.id;
  if (!canSendMessage(chatId, 'proxyip_command')) return;

  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');

    if (ipList.length === 0) {
      await bot.sendMessage(chatId, '⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*', { parse_mode: 'Markdown' });
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

  const rows = [];
  for (let i = 0; i < slice.length; i += 4) {
    rows.push(
      slice.slice(i, i + 4).map(code => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `select_${code}`
      }))
    );
  }

  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Prev', callback_data: 'page_prev' });
  if ((page + 1) * PAGE_SIZE < countryCodes.length) navButtons.push({ text: 'Next ➡️', callback_data: 'page_next' });
  if (navButtons.length) rows.push(navButtons);

  return rows;
}

export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'page_prev' || data === 'page_next') {
    if (!userPages.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Tidak ada halaman aktif.' });
      return;
    }
    const pageData = userPages.get(chatId);
    let newPage = pageData.page + (data === 'page_next' ? 1 : -1);
    if (newPage < 0) newPage = 0;
    if (newPage > Math.floor((pageData.countryCodes.length - 1) / PAGE_SIZE)) newPage = pageData.page;

    userPages.set(chatId, { ...pageData, page: newPage });

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
      const status = ipData.status === 'ACTIVE' ? '✅ ACTIVE' : '❌ DEAD';

      const safeProvider = provider.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      const protocolButtons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: '⬅️ Prev', callback_data: 'page_prev' },
          { text: 'Next ➡️', callback_data: 'page_next' },
          { text: '🔙 Back', callback_data: 'back_to_countries' }
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
      await bot.sendMessage(chatId, '⚠️ *Terjadi kesalahan saat memverifikasi IP.*', { parse_mode: 'Markdown' });
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
      const parts = data.split('_');
      const protocol = parts[1];
      const ip = parts[2];
      const port = parts[3];
      const countryCode = parts[4];
      const provider = parts[5];

      const uuid = generateUUID();

      let configText = '';

      switch (protocol) {
        case 'vless':
          configText = `vless://${uuid}@${ip}:${port}?type=ws&security=tls&sni=${DEFAULT_HOST}&path=%2Fvless#${countryCode}-${provider}`;
          break;
        case 'trojan':
          configText = `trojan://${uuid}@${ip}:${port}?type=ws&security=tls&sni=${DEFAULT_HOST}&path=%2Ftrojan#${countryCode}-${provider}`;
          break;
        case 'vmess':
          const vmessObj = {
            v: '2',
            ps: `${countryCode}-${provider}`,
            add: ip,
            port: port,
            id: uuid,
            aid: '0',
            net: 'ws',
            type: '',
            host: DEFAULT_HOST,
            path: '/vmess',
            tls: 'tls'
          };
          configText = `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
          break;
        case 'ss':
          const ssMethod = 'aes-128-gcm';
          const ssPass = uuid;
          configText = `ss://${Buffer.from(`${ssMethod}:${ssPass}`).toString('base64')}@${ip}:${port}#${countryCode}-${provider}`;
          break;
        default:
          configText = 'Protocol tidak dikenali.';
          break;
      }

      await bot.sendMessage(chatId, `⚡ *Config untuk ${protocol.toUpperCase()}:*\n\`\`\`\n${configText}\n\`\`\``, { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error generating config:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gagal membuat konfigurasi.' });
    }
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id, { text: 'Aksi tidak dikenal.' });
}
