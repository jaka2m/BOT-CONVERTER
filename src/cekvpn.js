// cekvpn.js

const WILDCARD_MAP = {
  ava: "ava.game.naver.com",
  api: "api.midtrans.com"
};

const WILDCARD_OPTIONS = Object.entries(WILDCARD_MAP).map(([value, text]) => ({
  text,
  value
}));

export let tempData = {};

// Fetch IP info from external API
export async function vpncf(ip, port, API_URL) {
  try {
    const response = await fetch(`${API_URL}${encodeURIComponent(ip)}:${encodeURIComponent(port)}`);
    if (!response.ok) throw new Error("Gagal mengambil data dari API.");
    return await response.json();
  } catch (error) {
    console.error("Error fetching IP data:", error);
    return null;
  }
}

// Protocol selection keyboard
export function createProtocolInlineKeyboard(ip, port) {
  return {
    inline_keyboard: [
      [
        { text: "⚡ VLESS", callback_data: `PROTOCOL|VLESS|${ip}|${port}` },
        { text: "⚡ TROJAN", callback_data: `PROTOCOL|TROJAN|${ip}|${port}` }
      ],
      [{ text: "⚡ VMESS", callback_data: `PROTOCOL|VMESS|${ip}|${port}` }],
      [{ text: "⚡ SHADOWSOCKS", callback_data: `PROTOCOL|SHADOWSOCKS|${ip}|${port}` }]
    ]
  };
}

// Wildcard prompt keyboard
export function createInitialWildcardInlineKeyboard(ip, port, protocol) {
  return {
    inline_keyboard: [
      [
        { text: "🚫 NO WILDCARD", callback_data: `NOWILDCARD|${protocol}|${ip}|${port}` },
        { text: "🔅 WILDCARD", callback_data: `SHOW_WILDCARD|${protocol}|${ip}|${port}` }
      ],
      [{ text: "🔙 Kembali", callback_data: `BACK|${ip}|${port}` }]
    ]
  };
}

// Wildcard list keyboard
export function createWildcardOptionsInlineKeyboard(ip, port, protocol) {
  const buttons = WILDCARD_OPTIONS.map((option, index) => [
    {
      text: `🔅 ${index + 1}. ${option.text}`,
      callback_data: `WILDCARD|${protocol}|${ip}|${port}|${option.value}`
    }
  ]);
  buttons.push([{ text: "🔙 Kembali", callback_data: `BACK|${ip}|${port}` }]);

  return { inline_keyboard: buttons };
}

// Generate proxy config based on protocol
export function generateConfig(config, protocol, DEFAULT_HOST, wildcardKey = null) {
  if (!config?.ip || !config?.port || !config?.isp) {
    return "❌ Data tidak valid!";
  }

  // Generate UUID v4
  const generateUUID = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  const toBase64 = (str) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...new Uint8Array(data.buffer)));
  };

  const host = wildcardKey ? `${WILDCARD_MAP[wildcardKey]}.${DEFAULT_HOST}` : DEFAULT_HOST;
  const sni = host;
  const uuid = generateUUID();
  const path = encodeURIComponent(`/Geo-Project/${config.ip}=${config.port}`);
  const pathh = `/Geo-Project/${config.ip}-${config.port}`;
  const uuid1 = "f282b878-8711-45a1-8c69-5564172123c1";
  const ispEncoded = encodeURIComponent(config.isp);
  let qrUrl = "";

  switch (protocol) {
    case "VMESS": {
      const vmessTLS = {
        v: "2",
        ps: "[VMess-TLS]",
        add: sni,
        port: "443",
        id: uuid1,
        aid: "0",
        net: "ws",
        type: "none",
        host,
        path: pathh,
        tls: "tls",
        sni,
        scy: "zero"
      };
      const vmessNTLS = { ...vmessTLS, port: "80", tls: "none", ps: "[VMess-NTLS]" };
      const configStringTLS = `vmess://${toBase64(JSON.stringify(vmessTLS))}`;
      const configStringNTLS = `vmess://${toBase64(JSON.stringify(vmessNTLS))}`;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configStringTLS)}&size=200x200`;

      return `
\`\`\`VMESS-TLS
${configStringTLS}
\`\`\`
\`\`\`VMESS-NTLS
${configStringNTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    }
    case "VLESS": {
      const vlessTLS = `vless://${uuid}@${host}:443?encryption=none&security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
      const vlessNTLS = `vless://${uuid}@${host}:80?path=${path}&security=none&encryption=none&host=${host}&fp=randomized&type=ws&sni=${host}#${ispEncoded}`;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(vlessTLS)}&size=200x200`;

      return `
\`\`\`VLESS-TLS
${vlessTLS}
\`\`\`
\`\`\`VLESS-NTLS
${vlessNTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    }
    case "TROJAN": {
      const trojanTLS = `trojan://${uuid}@${host}:443?security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
      const trojanNTLS = `trojan://${uuid}@${host}:80?path=${path}&security=none&encryption=none&host=${host}&fp=randomized&type=ws&sni=${host}#${ispEncoded}`;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(trojanTLS)}&size=200x200`;

      return `
\`\`\`TROJAN-TLS
${trojanTLS}
\`\`\`
\`\`\`TROJAN-NTLS
${trojanNTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    }
    case "SHADOWSOCKS": {
      const base64pass = toBase64(`none:${uuid}`);
      const ssTLS = `ss://${base64pass}@${host}:443?encryption=none&type=ws&host=${host}&path=${path}&security=tls&sni=${sni}#${ispEncoded}`;
      const ssNTLS = `ss://${base64pass}@${host}:80?encryption=none&type=ws&host=${host}&path=${path}&security=none&sni=${sni}#${ispEncoded}`;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ssTLS)}&size=200x200`;

      return `
\`\`\`SHADOWSOCKS-TLS
${ssTLS}
\`\`\`
\`\`\`SHADOWSOCKS-NTLS
${ssNTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    }
    default:
      return "❌ Unknown protocol!";
  }
}

// Example stub, implement as needed
export async function handleIpMessage(ip, port, API_URL) {
  // Example handler that uses vpncf to fetch IP info
  const data = await vpncf(ip, port, API_URL);
  if (!data) return "❌ Gagal mengambil data.";

  // Your custom logic here
  return generateConfig(data, "VMESS", "example.com");
}
