export async function checkProxyIP(link) {
  try {
    let ip = '';
    let port = '443'; // default port

    const clean = link.trim();
    [ip, port = '443'] = clean.split(':');

    // Validasi IP sederhana: 4 oktet angka
    const isValidIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    if (!isValidIP) {
      throw new Error('Invalid IP format');
    }

    const res = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    const data = await res.json();

    return {
      ip: data.ip || ip,
      port: data.port || port,
      status: data.status || 'UNKNOWN',
      delay: data.delay || '-',
      country: data.country || '-',
      flag: data.flag || '',
      city: data.city || '-',
      isp: data.isp || '-',
      regionName: data.regionName || '-',
      asn: data.asn ? `AS${data.asn}` : '-',
      timezone: data.timezone || '-',
      org: data.org || '-',
    };
  } catch (error) {
    return {
      ip: '-',
      port: '-',
      status: 'ERROR',
      delay: '-',
      country: '-',
      flag: '',
      city: '-',
      isp: '-',
      regionName: '-',
      asn: '-',
      timezone: '-',
      org: '-',
    };
  }
}

export async function configrotate(text, chatId) {
  // Validasi command dan parsing kode negara
  const args = text.trim().split(/\s+/);
  if (args.length !== 2) {
    await sendMessage(
      chatId,
      `⚠️ *Format salah! Gunakan contoh berikut:*\n\`/rotate id\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const countryCode = args[1].toLowerCase();
  const validCountries = [
    'id', 'sg', 'my', 'us', 'ca', 'in', 'gb', 'ir', 'ae', 'fi', 'tr', 'md', 'tw', 'ch', 'se',
    'nl', 'es', 'ru', 'ro', 'pl', 'al', 'nz', 'mx', 'it', 'de', 'fr', 'am', 'cy', 'dk', 'br',
    'kr', 'vn', 'th', 'hk', 'cn', 'jp',
  ];

  if (!validCountries.includes(countryCode)) {
    await sendMessage(
      chatId,
      `⚠️ *Kode negara tidak valid! Gunakan kode yang tersedia.*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Kirim pesan loading
  const loadingMessage = await sendMessage(chatId, '⏳ Sedang memproses config...');

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt'
    );
    const ipText = await response.text();

    // Parsing dan filter berdasarkan country code
    const ipList = ipText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    const filteredIpList = ipList
      .map((line) => line.split(','))
      .filter((parts) => parts.length >= 4 && parts[2].toLowerCase() === countryCode);

    if (filteredIpList.length === 0) {
      await sendMessage(chatId, `⚠️ *Tidak ada IP untuk negara ${countryCode.toUpperCase()}*`, {
        parse_mode: 'Markdown',
      });
      await deleteMessage(chatId, loadingMessage.message_id);
      return;
    }

    // Pilih IP acak dari list
    const [ip, port, country, provider] =
      filteredIpList[Math.floor(Math.random() * filteredIpList.length)];

    // Cek status IP
    const statusResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    const ipData = await statusResponse.json();

    if (ipData.status !== 'ACTIVE') {
      await sendMessage(chatId, `⚠️ *IP ${ip}:${port} tidak aktif.*`, {
        parse_mode: 'Markdown',
      });
      await deleteMessage(chatId, loadingMessage.message_id);
      return;
    }

    // Fungsi pembantu
    const getFlagEmoji = (code) =>
      code
        .toUpperCase()
        .split('')
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join('');
    const generateUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    const toBase64 = (str) => Buffer.from(str, 'utf-8').toString('base64');

    const flag = getFlagEmoji(countryCode);
    const HOSTKU = 'joss.checker-ip.xyz';
    const path = `/Geo-Project/${ip}-${port}`;
    const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';
    const TELEGRAM_TOKEN = '7664381872:AAHfoMYhaUYlzRgMlydfA3zvwkMyVLMhoTU';
    const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;


    // Config VMess TLS dan NTLS
    const vmessTLS = {
      v: '2',
      ps: `${countryCode.toUpperCase()} ${flag} [VMess-TLS]`,
      add: HOSTKU,
      port: '443',
      id: uuid1,
      aid: '0',
      net: 'ws',
      type: 'none',
      host: HOSTKU,
      path: path,
      tls: 'tls',
      sni: HOSTKU,
      scy: 'zero',
    };

    const vmessNTLS = {
      ...vmessTLS,
      ps: `${countryCode.toUpperCase()} ${flag} [VMess-NTLS]`,
      port: '80',
      tls: 'none',
    };

    const configText = `
\`\`\`INFORMATION
IP      : ${ip}
PORT    : ${port}
ISP     : ${provider}
COUNTRY : ${countryCode.toUpperCase()} ${flag}
STATUS  : ✅ ACTIVE
\`\`\`
🌟 *ROTATE VMESS TLS* 🌟
\`\`\`
vmess://${toBase64(JSON.stringify(vmessTLS))}
\`\`\`
🌟 *ROTATE VMESS NTLS* 🌟
\`\`\`
vmess://${toBase64(JSON.stringify(vmessNTLS))}
\`\`\`
🌟 *ROTATE VLESS TLS* 🌟
\`\`\`
vless://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${path}#ROTATE%20VLESS%20${countryCode.toUpperCase()}%20${flag}%20TLS
\`\`\`
🌟 *ROTATE VLESS NTLS* 🌟
\`\`\`
vless://${generateUUID()}@${HOSTKU}:80?path=${path}&security=none&encryption=none&host=${HOSTKU}&fp=randomized&type=ws&sni=${HOSTKU}#ROTATE%20VLESS%20${countryCode.toUpperCase()}%20${flag}%20NTLS
\`\`\`
🌟 *ROTATE TROJAN TLS* 🌟
\`\`\`
trojan://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${path}#ROTATE%20TROJAN%20${countryCode.toUpperCase()}%20${flag}%20TLS
\`\`\`
🌟 *ROTATE SS TLS* 🌟
\`\`\`
ss://${toBase64(`none:${generateUUID()}`)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${path}&security=tls&sni=${HOSTKU}#ROTATE%20SHADOWSOCKS%20${countryCode.toUpperCase()}%20${flag}%20TLS
\`\`\`
🌟 *ROTATE SS NTLS* 🌟
\`\`\`
ss://${toBase64(`none:${generateUUID()}`)}@${HOSTKU}:80?encryption=none&type=ws&host=${HOSTKU}&path=${path}&security=none&sni=${HOSTKU}#ROTATE%20SHADOWSOCKS%20${countryCode.toUpperCase()}%20${flag}%20NTLS
\`\`\`

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;

    await sendMessage(chatId, configText, { parse_mode: 'Markdown' });
    await deleteMessage(chatId, loadingMessage.message_id);

    return configText;
  } catch (error) {
    console.error(error);
    await sendMessage(chatId, `⚠️ Terjadi kesalahan: ${error.message}`);
    await deleteMessage(chatId, loadingMessage.message_id);
    return null;
  }
}

// Fungsi hapus pesan Telegram
async function deleteMessage(chatId, messageId) {
  const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error('Gagal menghapus pesan:', data.description);
  }
}
