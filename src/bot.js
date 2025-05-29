// proxyUtils.js

export let globalIpList = [];
export let globalCountryCodes = [];

// Ambil daftar IP dan simpan global
export async function fetchProxyList(url) {
  const response = await fetch(url);
  const ipText = await response.text();
  const ipList = ipText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
  return ipList;
}

// Generate emoji bendera dari kode negara (cc)
export function getFlagEmoji(code) {
  const OFFSET = 127397;
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
    .join('');
}

// Buat inline keyboard tombol flag negara dengan pagination
export function buildCountryButtons(page = 0, pageSize = 15) {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = globalCountryCodes.slice(start, end);

  // Buat tombol flag + kode negara (3 per baris)
  const buttons = pageItems.map(code => ({
    text: `${getFlagEmoji(code)} ${code}`,
    callback_data: `cc_${code}`,
  }));

  const inline_keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    inline_keyboard.push(buttons.slice(i, i + 3));
  }

  // Tombol navigasi Prev / Next
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Prev', callback_data: `randomip_page_${page - 1}` });
  if (end < globalCountryCodes.length) navButtons.push({ text: 'Next ➡️', callback_data: `randomip_page_${page + 1}` });
  if (navButtons.length) inline_keyboard.push(navButtons);

  return { inline_keyboard };
}

// Generate pesan 20 IP acak
export function generateRandomIPsMessage(ipList, count = 20) {
  const shuffled = [...ipList].sort(() => 0.5 - Math.random());
  const selectedIPs = shuffled.slice(0, count);

  let resultText = `🔑 *Here are ${selectedIPs.length} random Proxy IPs:*\n\n`;
  selectedIPs.forEach(line => {
    const [ip, port, code, isp] = line.split(',');
    resultText += `📍 *IP:PORT* : \`${ip}:${port}\`\n`;
    resultText += `🌐 *Country* : ${code} ${getFlagEmoji(code)}\n`;
    resultText += `💻 *ISP* : ${isp}\n\n`;
  });

  return resultText;
}

// Generate pesan IP berdasarkan filter kode negara
export function generateCountryIPsMessage(ipList, countryCode) {
  const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

  if (filteredIPs.length === 0) return null;

  let msg = `🌐 *Proxy IP untuk negara ${countryCode} ${getFlagEmoji(countryCode)}:*\n\n`;

filteredIPs.slice(0, 20).forEach(line => {
  const [ip, port, _code, isp] = line.split(',');
  msg += `
📍 *IP:PORT* : \`${ip}:${port}\` 
🌐 *Country* : ${_code} ${getFlagEmoji(_code)}
💻 *ISP* : ${isp}\n\n
`;
});

return msg;
}

// Handler untuk command /randomip
export async function handleRandomIpCommand(bot, chatId) {
  try {
    globalIpList = await fetchProxyList('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');

    if (globalIpList.length === 0) {
      await bot.sendMessage(chatId, `⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*`, { parse_mode: 'Markdown' });
      return;
    }

    globalCountryCodes = [...new Set(globalIpList.map(line => line.split(',')[2]))].sort();

    // *** Hanya kirim pesan pilihan negara dulu ***
    const text = 'Silakan pilih negara untuk mendapatkan IP random:';
    const reply_markup = buildCountryButtons(0);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Gagal mengambil data IP: ${error.message}`);
  }
}

// Handler untuk callback query tombol inline keyboard
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  if (data.startsWith('randomip_page_')) {
    const page = parseInt(data.split('_')[2], 10);
    const keyboard = buildCountryButtons(page);

    await bot.editMessageReplyMarkup({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
    });

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith('cc_')) {
    const code = data.split('_')[1];
    const msg = generateCountryIPsMessage(globalIpList, code);

    if (!msg) {
      await bot.sendMessage(chatId, `⚠️ Tidak ditemukan IP untuk negara: ${code}`, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    }

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
}
