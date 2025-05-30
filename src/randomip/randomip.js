// randomip.js

import fs from 'fs/promises';

export let globalIpList = [];
export let globalCountryCodes = [];

// 1. Ambil daftar proxy dari URL eksternal
export async function fetchProxyList(url) {
  const response = await fetch(url);
  const ipText = await response.text();
  return ipText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
}

// 2. Generate emoji bendera dari kode negara (ISO 2 huruf)
export function getFlagEmoji(code) {
  const OFFSET = 127397;
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
    .join('');
}

// 3. Bangun inline keyboard tombol negara dengan pagination
export function buildCountryButtons(page = 0, pageSize = 15) {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = globalCountryCodes.slice(start, end);

  // Tombol per negara (maksimal 3 tombol per baris)
  const buttons = pageItems.map(code => ({
    text: `${getFlagEmoji(code)} ${code}`,
    callback_data: `cc_${code}`,
  }));

  const inline_keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    inline_keyboard.push(buttons.slice(i, i + 3));
  }

  // Tombol Prev / Next
  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: '⬅️ Prev', callback_data: `randomip_page_${page - 1}` });
  }
  if (end < globalCountryCodes.length) {
    navButtons.push({ text: 'Next ➡️', callback_data: `randomip_page_${page + 1}` });
  }
  if (navButtons.length) inline_keyboard.push(navButtons);

  return { inline_keyboard };
}

// 4. Generate file buffer .txt berisi IP sesuai negara
export function generateCountryIPsFileBuffer(ipList, countryCode) {
  const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);
  if (filteredIPs.length === 0) return null;

  const textLines = filteredIPs.map(line => {
    const [ip, port, code, isp] = line.split(',');
    return `IP:PORT => ${ip}:${port}\nCountry: ${code}\nISP: ${isp}`;
  });
  const textContent = textLines.join('\n\n');

  return Buffer.from(textContent, 'utf-8');
}

// 5. Handler untuk command `/proxy`
export async function handleRandomIpCommand(bot, chatId) {
  try {
    // 5.1 Fetch globalIpList dari repo GitHub
    globalIpList = await fetchProxyList(
      'https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt'
    );

    if (globalIpList.length === 0) {
      await bot.sendMessage(chatId, `⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // 5.2 Kumpulkan kode negara unik dan sorting
    globalCountryCodes = [...new Set(globalIpList.map(line => line.split(',')[2]))].sort();

    // 5.3 Kirim pesan dengan inline keyboard tombol negara (halaman 0)
    const text = '🌐 *Silakan pilih negara untuk mendapatkan daftar proxy (dalam file .txt):*';
    const reply_markup = buildCountryButtons(0);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Gagal mengambil data IP: ${err.message}`, {
      parse_mode: 'Markdown',
    });
  }
}

// 6. Handler untuk callback query tombol inline
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  // 6.1 Jika tombol navigasi halaman ditekan
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

  // 6.2 Jika tombol negara ditekan
  if (data.startsWith('cc_')) {
    const code = data.split('_')[1];
    const buffer = generateCountryIPsFileBuffer(globalIpList, code);

    if (!buffer) {
      // Jika tidak ada IP untuk negara tersebut
      await bot.sendMessage(chatId, `⚠️ Tidak ditemukan proxy untuk negara: ${code}`, {
        parse_mode: 'Markdown',
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Simpan sementara file di /tmp (misal di Bun.js environment)
    const filePath = `/tmp/proxy_${code}.txt`;
    await fs.writeFile(filePath, buffer);

    // Kirim file .txt langsung ke user
    await bot.sendDocument(chatId, filePath, {
      caption: `📄 Daftar proxy negara ${code} ${getFlagEmoji(code)}`,
      parse_mode: 'Markdown',
    });

    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  // Jika callback_query lain muncul, cukup jawab tanpa melakukan apa-apa
  await bot.answerCallbackQuery(callbackQuery.id);
}
