export async function checkProxyIP(link) {
  try {
    let ip = '';
    let port = '443';

    // Bersihkan dan pecah IP:PORT
    const clean = link.trim();
    [ip, port = '443'] = clean.split(':');

    // Validasi format IP
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
      flag: '',
      city: data.city || '-',
      isp: data.isp || '-',
      regionName: data.regionName || '-',
      asn: data.asn ? `AS${data.asn}` : '-',
      timezone: data.timezone || '-',
      org: data.org || '-',
      configText: '',
    };

    // Konversi string ke Base64 universal
    const toBase64 = (str) => {
      if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
      return Buffer.from(str, 'utf-8').toString('base64');
    };

    // Emoji bendera berdasarkan kode negara
    const getFlagEmoji = (countryCode) => {
      if (!countryCode) return '';
      return countryCode
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
    };

    // Dummy UUID generator (gunakan yang valid jika perlu)
    const generateUUID = () =>
      crypto.randomUUID?.() || '11111111-1111-1111-1111-111111111111';

    if (result.status === 'ACTIVE') {
      const flag = getFlagEmoji(data.country);
      result.flag = flag;

      const rawCountry = data.country || 'UNKNOWN';
      const rawProvider = data.org || data.isp || 'UNKNOWN';

     const country = encodeURIComponent(rawCountry);
     const provider = encodeURIComponent(rawProvider);

     const HOSTKU = 'joss.checker-ip.xyz';
     const path = encodeURIComponent(`/Geo-Project/${ip}-${port}`);

      const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';
      const vlessUUID = generateUUID();
      const trojanUUID = generateUUID();
      const ssPassword = generateUUID();

      // VMess config
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

      const vmessNTLS = {
        ...vmessTLS,
        ps: `${country} - ${provider} [VMess-NTLS]`,
        port: "80",
        tls: "none"
      };

      const vmessTLSLink = `vmess://${toBase64(JSON.stringify(vmessTLS))}`;
      const vmessNTLSLink = `vmess://${toBase64(JSON.stringify(vmessNTLS))}`;

      // VLESS config
      const vlessTLSLink = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${path}#${provider}`;
      const vlessNTLSLink = `vless://${vlessUUID}@${HOSTKU}:80?path=${path}&security=none&encryption=none&host=${HOSTKU}&fp=randomized&type=ws&sni=${HOSTKU}#${provider}`;

      // Trojan config
      const trojanTLSLink = `trojan://${trojanUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${path}#${provider}`;
      const trojanNTLSLink = `trojan://${trojanUUID}@${HOSTKU}:80?path=${path}&security=none&encryption=none&host=${HOSTKU}&fp=randomized&type=ws&sni=${HOSTKU}#${provider}`;

      // Shadowsocks config
      const ssBase = toBase64(`none:${ssPassword}`);
      const ssTLSLink = `ss://${ssBase}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${path}&security=tls&sni=${HOSTKU}#${provider}`;
      const ssNTLSLink = `ss://${ssBase}@${HOSTKU}:80?encryption=none&type=ws&host=${HOSTKU}&path=${path}&security=none#${provider}`;

      // Informasi lengkap
      const infoMessage = `
ISP     : ${result.isp}
IP      : ${result.ip}
Proxy   : ${result.proxy}
Port    : ${result.port}
Country : ${result.country}
Delay   : ${result.delay}
Status  : ✅ ${result.status}
`;

      const configText = `
\`\`\`\`\`\`INFORMATION
${infoMessage.trim()}
\`\`\`\`\`\`
\`\`\`\`\`\`VMESS-TLS
${vmessTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`VMESS-NTLS
${vmessNTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`VLESS-TLS
${vlessTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`VLESS-NTLS
${vlessNTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`TROJAN-TLS
${trojanTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`TROJAN-NTLS
${trojanNTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`SHADOWSOCKS-TLS
${ssTLSLink}
\`\`\`\`\`\`
\`\`\`\`\`\`SHADOWSOCKS-NTLS
${ssNTLSLink}
\`\`\`\`\`\`
\`\`\`👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
\`\`\`
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
