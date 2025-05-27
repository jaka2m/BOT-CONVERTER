// Fungsi cek IP proxy dengan API checker-ip.web.id
export async function checkProxyIP(link) {
  try {
    let ip = '';
    let port = '443';

    const clean = link.trim();
    [ip, port = '443'] = clean.split(':');

    // Validasi IP format
    const isValidIP = ip.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (!isValidIP) throw new Error('Invalid IP format');

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
      org: data.org || '-'
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
      org: '-'
    };
  }
}

// Helper untuk konversi kode negara jadi emoji bendera
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return countryCode
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

// Simple UUID v4 generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fungsi utama generate config proxy random
export async function randomconfig() {
  const HOSTKU = 'example.com'; // Ganti dengan host kamu

  // Ambil list proxy dari file txt
  const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/main/cek/proxyList.txt');
  const ipText = await response.text();
  const ipList = ipText.split('\n').filter(line => line.trim() !== '');
  const randomProxy = ipList[Math.floor(Math.random() * ipList.length)];
  const [ip, port, country, provider] = randomProxy.split(',');

  if (!ip || !port) return '⚠️ Data IP tidak lengkap.';

  // Cek status IP
  const data = await checkProxyIP(`${ip}:${port}`);
  if (data.status?.toUpperCase() !== 'ACTIVE') {
    return `⚠️ IP ${ip}:${port} tidak aktif.`;
  }

  const flag = getFlagEmoji(data.country);
  const status = "✅ ACTIVE";
  const path = `/Geo-Project/${ip}-${port}`;
  const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1'; // UUID tetap

  // Base64 encoder yang support Node & Browser
  const toBase64 = (str) => {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    else return Buffer.from(str, 'utf-8').toString('base64');
  };

  const infoMessage = `
IP       : ${data.ip}
PORT     : ${data.port}
ISP      : ${data.isp}
COUNTRY  : ${data.country} ${flag}
STATUS   : ${status}
DELAY    : ${data.delay} ms
ASN      : ${data.asn}
ORG      : ${data.org}
`;

  // VMess TLS config
  const vmessTLS = {
    v: "2",
    ps: `${country} - ${provider} [VMess-TLS]`,
    add: HOSTKU,
    port: "443",
    id: uuid1,
    aid: "0",
    net: "ws",
    type: "none",
    host: HOSTKU,
    path: path,
    tls: "tls",
    sni: HOSTKU,
    scy: "zero"
  };
  const vmesstls = `vmess://${toBase64(JSON.stringify(vmessTLS))}`;

  // UUID untuk VLess, Trojan, SS
  const vlessUUID = generateUUID();
  const trojanUUID = generateUUID();
  const ssUUID = generateUUID();

  // VLess TLS config
  const vlesstls = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${provider}%20${country}`;

  // Trojan TLS config
  const trojantls = `trojan://${trojanUUID}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${provider}%20${country}`;

  // Shadowsocks TLS config
  const ssntls = `ss://${toBase64(`none:${ssUUID}`)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}&security=tls&sni=${HOSTKU}#${provider}%20${country}`;

  // Format output final
  const configText = `
\`\`\`INFORMATION
${infoMessage}
\`\`\`
\`\`\`VMESS-TLS
${vmesstls}
\`\`\`
\`\`\`VLESS-TLS
${vlesstls}
\`\`\`
\`\`\`TROJAN-TLS
${trojantls}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssntls}
\`\`\`
`;

  return configText;
}
