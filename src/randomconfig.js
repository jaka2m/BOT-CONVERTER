function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return countryCode
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function randomconfig() {
  try {
    const HOSTKU = 'joss.krikkrik.tech';
    const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/jaka2m/botak/main/cek/';

    // --- Ambil daftar proxy dari GitHub ---
    const proxyResponse = await fetch(`${GITHUB_BASE_URL}proxyList.txt`);
    if (!proxyResponse.ok) {
      return '⚠️ Gagal mengambil daftar proxy.';
    }
    const ipText = await proxyResponse.text();
    const ipLines = ipText.split('\n').filter(line => line.trim() !== '');

    if (ipLines.length === 0) {
      return '⚠️ Daftar proxy kosong atau tidak valid.';
    }

    // --- Pilih proxy secara acak dan dapatkan indeksnya ---
    const randomIndex = Math.floor(Math.random() * ipLines.length);
    const randomProxyLine = ipLines[randomIndex];
    
    // Angka urutan adalah (indeks + 1)
    const sequenceNumber = randomIndex + 1; 

    const [ip, port, country, provider] = randomProxyLine.split(',');

    if (!ip || !port) {
      return '⚠️ Data IP atau Port tidak lengkap dari daftar proxy.';
    }

    // --- Lakukan cek status IP ---
    const checkResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    if (!checkResponse.ok) {
      return `⚠️ Gagal cek status IP ${ip}:${port}.`;
    }
    const data = await checkResponse.json(); // Data ini berisi countryCode, ip, port, dll.

    if (data.status?.toUpperCase() !== 'ACTIVE') {
      return `⚠️ IP ${ip}:${port} tidak aktif.`;
    }
    
    // --- Buat path untuk konfigurasi dengan angka urutan dinamis ---
    const pathIPPORT = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;
    // Menggunakan sequenceNumber yang didapat dari indeks baris
    const pathCD = `/Free-VPN-CF-Geo-Project/${data.countryCode}${sequenceNumber}`;

    const toBase64 = (str) => Buffer.from(str).toString('base64');
    const btoa = (str) => Buffer.from(str).toString('base64');

    const infoMessage = `
IP      : ${data.ip}
PORT    : ${data.port}
ISP     : ${data.isp}
COUNTRY : ${data.country}
DELAY   : ${data.delay}
STATUS  : ${data.status}
`;

    // --- Konfigurasi dengan path IP/PORT ---
    const vlessTLSLink1 = `vless://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathIPPORT)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const trojanTLSLink1 = `trojan://${generateUUID()}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathIPPORT)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const ssTLSLink1 = `ss://${toBase64(`none:${generateUUID()}`)}@$${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathIPPORT)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

    // --- Konfigurasi dengan path Country Code + Sequence Number ---
    const vlessTLSLink2 = `vless://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCD)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const trojanTLSLink2 = `trojan://${generateUUID()}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCD)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const ssTLSLink2 = `ss://${toBase64(`none:${generateUUID()}`)}@$${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCD)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

    // --- Format output teks ---
    const configText = `
\`\`\`INFORMATION
${infoMessage}
\`\`\`\`\`\`VLESS-TLS
${vlessTLSLink1}
\`\`\`\`\`\`TROJAN-TLS
${trojanTLSLink1}
\`\`\`\`\`\`SHADOWSOCKS-TLS
${ssTLSLink1}
\`\`\`

(Country Code Path : ${data.countryCode}${sequenceNumber})

\`\`\`VLESS-TLS
${vlessTLSLink2}
\`\`\`\`\`\`TROJAN-TLS
${trojanTLSLink2}
\`\`\`\`\`\`SHADOWSOCKS-TLS
${ssTLSLink2}
\`\`\`

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    return configText;

  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    return `⚠️ Terjadi kesalahan: ${error.message}`;
  }
}
