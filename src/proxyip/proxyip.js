// proxyip.js

const DEFAULT_HOST = 'your.host.com';
const APIKU = 'https://api.checker-ip.web.id/check?ip=';

function getFlagEmoji(countryCode) {
  const codePoints = [...countryCode].map(c => 0x1F1E6 - 65 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function handleProxyIpCommand(bot, chatId) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');

    if (ipList.length === 0) {
      return bot.sendMessage(chatId, `⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*`, { parse_mode: 'Markdown' });
    }

    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))];
    const buttons = [];

    for (let i = 0; i < countryCodes.length; i += 4) {
      buttons.push(
        countryCodes.slice(i, i + 4).map(code => ({
          text: `${getFlagEmoji(code)} ${code}`,
          callback_data: `select_${code}`
        }))
      );
    }

    await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

export async function handleCountrySelection(bot, chatId, countryCode) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');
    const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

    if (filteredIPs.length === 0) {
      return bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk negara ${countryCode}.*`, { parse_mode: 'Markdown' });
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
      `\`\`\`INFORMATION
IP      : ${ip}
PORT    : ${port}
ISP     : ${provider}
COUNTRY : ${ipData.country}
STATUS  : ${status}
\`\`\``;

    if (ipData.latitude && ipData.longitude) {
      messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
    }

    await bot.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });

  } catch (error) {
    console.error('Error fetching IP status:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memverifikasi IP.*`, { parse_mode: 'Markdown' });
  }
}

export async function handleConfigGeneration(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

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
      v: "2", ps: `${countryCode} - ${prov1} [VMess-TLS]`, add: DEFAULT_HOST, port: "443", id: uuid1, aid: "0",
      net: "ws", type: "none", host: DEFAULT_HOST, path: pathh, tls: "tls", sni: DEFAULT_HOST, scy: "zero"
    };
    const vmessNTLS = { ...vmessTLS, port: "80", tls: "none", ps: `${countryCode} - ${prov1} [VMess-NTLS]` };

    configText = `\`\`\`VMESS-TLS\nvmess://${toBase64(JSON.stringify(vmessTLS))}\`\`\`\n` +
                 `\`\`\`VMESS-NTLS\nvmess://${toBase64(JSON.stringify(vmessNTLS))}\`\`\``;
  }

  else if (type === 'vless') {
    configText = `\`\`\`VLESS-TLS
vless://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\n\`\`\`VLESS-NTLS
vless://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\``;
  }

  else if (type === 'trojan') {
    configText = `\`\`\`TROJAN-TLS
trojan://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\n\`\`\`TROJAN-NTLS
trojan://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\``;
  }

  else if (type === 'ss') {
    const base64 = toBase64(`none:${uuid}`);
    configText = `\`\`\`SHADOWSOCKS-TLS
ss://${base64}@${DEFAULT_HOST}:443?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=tls&sni=${DEFAULT_HOST}#${prov}
\`\`\`\n\`\`\`SHADOWSOCKS-NTLS
ss://${base64}@${DEFAULT_HOST}:80?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=none&sni=${DEFAULT_HOST}#${prov}
\`\`\``;
  }

  else {
    return bot.answerCallbackQuery(callbackQuery.id, { text: "Protokol tidak dikenali." });
  }

  const infoText = `✅ *Konfigurasi ${type.toUpperCase()} untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
    "```\nINFORMATION\n" +
    `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${countryCode} ${getFlagEmoji(countryCode)}\nSTATUS  : ✅ ACTIVE\n` +
    "```";

  await bot.sendMessage(chatId, `${infoText}${configText}\n👨‍💻 Modded By: [GEO PROJECT](https://t.me/sampiiiiu)`, {
    parse_mode: 'Markdown'
  });

  await bot.answerCallbackQuery(callbackQuery.id);
}
