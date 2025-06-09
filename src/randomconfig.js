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

// Base64 encoder yang support Node & Browser
const toBase64 = (str) => {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  else if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf-8').toString('base64');
  else throw new Error('Base64 encoding not supported in this environment.');
};

// Fungsi utama generate config proxy random
export async function randomconfig() {
  try {
    const HOSTKU = 'joss.krikkrik.tech';

    // Ambil list proxy dari file txt
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/main/cek/proxyList.txt');
    if (!response.ok) return '⚠️ Gagal mengambil daftar proxy.';
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');
    const randomProxy = ipList[Math.floor(Math.random() * ipList.length)];
    // Di sini 'country' bisa jadi nama lengkap (misal: "France")
    const [ip, port, country, provider] = randomProxy.split(','); 

    if (!ip || !port) return '⚠️ Data IP tidak lengkap.';

    // Cek status IP dengan fetch API
    const checkResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    if (!checkResponse.ok) return `⚠️ Gagal cek status IP ${ip}:${port}.`;
    const data = await checkResponse.json();

    if (data.status?.toUpperCase() !== 'ACTIVE') {
      return `⚠️ IP ${ip}:${port} tidak aktif.`;
    }

    // Pastikan countryCode yang digunakan di sini adalah yang singkat dari data.country
    const countryCodeFromAPI = data.country ? data.country.toUpperCase() : 'UNKNOWN'; 
    const flag = getFlagEmoji(countryCodeFromAPI); // Gunakan countryCodeFromAPI untuk bendera
    const status = "✅ ACTIVE";

    // UUID untuk VLess, Trojan, SS
    const vlessUUID = generateUUID();
    const trojanUUID = generateUUID();
    const ssPassword = generateUUID();

    const infoMessage = `
IP      : ${data.ip}
PORT    : ${data.port}
ISP     : ${data.isp}
COUNTRY : ${data.country} ${flag}
STATUS  : ${status}
DELAY   : ${data.delay} ms
ASN     : ${data.asn}
ORG     : ${data.org}
`;

    // --- Opsi Path 1: Berdasarkan IP dan Port ---
    const path1 = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;
    const vlessTLSLink1 = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path1)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}%20(IP-PORT)`;
    const trojanTLSLink1 = `trojan://${trojanUUID}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path1)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}%20(IP-PORT)`;
    const ssConfig1 = `none:${ssPassword}`;
    const ssTLSLink1 = `ss://${toBase64(ssConfig1)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path1)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}%20(IP-PORT)`;

    // --- Opsi Path 2: Berdasarkan Country Code dengan Variasi Angka ---
    const numCountryPathVariants = 3; // Ubah angka ini untuk jumlah varian path yang Anda inginkan
    let countryPathConfigs = '';

    for (let i = 1; i <= numCountryPathVariants; i++) {
        // PERBAIKAN DI SINI: Pastikan menggunakan countryCodeFromAPI yang merupakan singkatan 2 huruf
        const pathCountry = `/Free-VPN-CF-Geo-Project/${countryCodeFromAPI}${i}`;

        const vlessTLSLinkCountry = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCountry)}#${encodeURIComponent(provider)}%20${encodeURIComponent(data.country)}%20(Country-Code-${i})`;
        const trojanTLSLinkCountry = `trojan://${trojanUUID}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCountry)}#${encodeURIComponent(provider)}%20${encodeURIComponent(data.country)}%20(Country-Code-${i})`;
        const ssConfigCountry = `none:${ssPassword}`;
        const ssTLSLinkCountry = `ss://${toBase64(ssConfigCountry)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(pathCountry)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(data.country)}%20(Country-Code-${i})`;

        countryPathConfigs += `
---
### Opsi Path Country Code ${i}: (\`${pathCountry}\`)
\`\`\`VLESS-TLS
${vlessTLSLinkCountry}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLinkCountry}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLinkCountry}
\`\`\`
`;
    }

    // --- Format Output Akhir ---
    const configText = `
\`\`\`INFORMATION
${infoMessage}
\`\`\`

---
### Opsi Path 1: IP-PORT (\`${path1}\`)
\`\`\`VLESS-TLS
${vlessTLSLink1}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLink1}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLink1}
\`\`\`
${countryPathConfigs}

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    return configText;
  } catch (error) {
    return `⚠️ Terjadi kesalahan: ${error.message}`;
  }
}
