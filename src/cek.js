const WILDCARD_MAP = {
  ava: "ava.game.naver.com",
  api: "api.midtrans.com"
};

const WILDCARD_OPTIONS = Object.entries(WILDCARD_MAP).map(
  ([value, text]) => ({ text, value })
);

const DEFAULT_HOST = "your.default.host"; // ganti sesuai kebutuhan
const API_URL = "https://api.checker-ip.web.id/check?ip="; // ganti sesuai API Anda

export async function fetchIPData(ip, port) {
  try {
    const response = await fetch(`${API_URL}${encodeURIComponent(ip)}:${encodeURIComponent(port)}`);
    if (!response.ok) throw new Error("Gagal mengambil data dari API.");
    return await response.json();
  } catch (error) {
    console.error("Error fetching IP data:", error);
    return null;
  }
}

export function createProtocolInlineKeyboard(ip, port) {
  return {
    inline_keyboard: [
      [
        { text: "⚡ VLESS", callback_data: `PROTOCOL|VLESS|${ip}|${port}` },
        { text: "⚡ TROJAN", callback_data: `PROTOCOL|TROJAN|${ip}|${port}` }
      ],
      [
        { text: "⚡ VMESS", callback_data: `PROTOCOL|VMESS|${ip}|${port}` }
      ],
      [
        { text: "⚡ SHADOWSOCKS", callback_data: `PROTOCOL|SHADOWSOCKS|${ip}|${port}` }
      ]
    ]
  };
}

export function createInitialWildcardInlineKeyboard(ip, port, protocol) {
  return {
    inline_keyboard: [
      [
        { text: "🚫 NO WILDCARD", callback_data: `NOWILDCARD|${protocol}|${ip}|${port}` },
        { text: "🔅 WILDCARD", callback_data: `SHOW_WILDCARD|${protocol}|${ip}|${port}` }
      ],
      [
        { text: "🔙 Kembali", callback_data: `BACK|${ip}|${port}` }
      ]
    ]
  };
}

export function createWildcardOptionsInlineKeyboard(ip, port, protocol) {
  const buttons = WILDCARD_OPTIONS.map((option, index) => [
    { text: `🔅 ${index + 1}. ${option.text}`, callback_data: `WILDCARD|${protocol}|${ip}|${port}|${option.value}` }
  ]);
  buttons.push([{ text: "🔙 Kembali", callback_data: `BACK|${ip}|${port}` }]);
  return { inline_keyboard: buttons };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function toBase64(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...new Uint8Array(data.buffer)));
}

/**
 * Generate config string based on protocol, data, and wildcardKey
 * @param {object} config {ip, port, isp, latitude, longitude}
 * @param {string} protocol "VMESS" | "VLESS" | "TROJAN" | "SHADOWSOCKS"
 * @param {string|null} wildcardKey key for WILDCARD_MAP or null
 * @returns {string} config string with markdown formatting
 */
export function generateConfig(config, protocol, wildcardKey = null) {
  if (!config || !config.ip || !config.port || !config.isp) {
    return "❌ Data tidak valid!";
  }

  const host = wildcardKey ? `${WILDCARD_MAP[wildcardKey]}.${DEFAULT_HOST}` : DEFAULT_HOST;
  const sni = host;
  const uuid = generateUUID();
  const path = encodeURIComponent(`/Geo-Project/${config.ip}=${config.port}`);
  const pathh = `/Geo-Project/${config.ip}-${config.port}`;
  const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1'; // fixed UUID for VMESS
  const ispEncoded = encodeURIComponent(config.isp);
  let qrUrl = "";

  if (protocol === "VMESS") {
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

    const configStringTLS = `vmess://${toBase64(JSON.stringify(vmessTLS))}`;
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configStringTLS)}&size=200x200`;

    return `
\`\`\`VMESS-TLS
${configStringTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
  }

  if (protocol === "VLESS") {
    const vlessTLS = `vless://${uuid}@${host}:443?encryption=none&security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(vlessTLS)}&size=200x200`;

    return `
\`\`\`VLESS-TLS
${vlessTLS}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
  }

  if (protocol === "TROJAN") {
    const trojanConfig = `trojan://${uuid}@${host}:443?security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(trojanConfig)}&size=200x200`;

    return `
\`\`\`TROJAN-TLS
${trojanConfig}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
  }

  if (protocol === "SHADOWSOCKS") {
    const ssConfig = `ss://${toBase64(`none:${uuid}`)}@${host}:443?encryption=none&type=ws&host=${host}&path=${path}&security=tls&sni=${sni}#${ispEncoded}`;
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ssConfig)}&size=200x200`;

    return `
\`\`\`SHADOWSOCKS-TLS
${ssConfig}
\`\`\`
👉 [QR Code URL](${qrUrl})
🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
  }

  return "❌ Unknown protocol!";
}
