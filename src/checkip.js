// checkip.js
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

    const result = {
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
      configText: '',
    };

    // Base64 universal (browser & node)
    const toBase64 = (str) => {
      if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
      else return Buffer.from(str, 'utf-8').toString('base64');
    };

    // Emoji bendera
    const getFlagEmoji = (countryCode) => {
      if (!countryCode) return '';
      return countryCode
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
    };

    // UUID generator dummy (ganti sesuai real UUID jika perlu)
    const generateUUID = () => crypto.randomUUID?.() || '11111111-1111-1111-1111-111111111111';

    if (result.status === 'ACTIVE') {
      const flag = getFlagEmoji(data.country);
      const country = data.country || 'UNKNOWN';
      const provider = data.org || data.isp || 'UNKNOWN';
      const HOSTKU = result.ip;
      const path = `/Geo-Project/${ip}-${port}`;

      const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1'; // UUID tetap
      const vlessUUID = generateUUID();
      const trojanUUID = generateUUID();
      const ssPassword = generateUUID();

      // VMess TLS
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
      const vmessTLSLink = `vmess://${toBase64(JSON.stringify(vmessTLS))}`;

      // VLESS TLS
      const vlessTLSLink = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

      // TROJAN TLS
      const trojanTLSLink = `trojan://${trojanUUID}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

      // SHADOWSOCKS TLS
      const ssConfig = `none:${ssPassword}`;
      const ssTLSLink = `ss://${toBase64(ssConfig)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

      // Informasi lengkap
      const infoMessage = `
${flag} ${country}
ISP: ${provider}
IP: ${ip}
Ping: ${result.delay} ms
Status: ✅ ACTIVE
`;

      const configText = `
\`\`\`INFORMATION
${infoMessage.trim()}
\`\`\`
\`\`\`VMESS-TLS
${vmessTLSLink}
\`\`\`
\`\`\`VLESS-TLS
${vlessTLSLink}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLink}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLink}
\`\`\`

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`.trim();

      result.configText = configText;
    }

    return result;

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
      configText: ''
    };
  }
}
