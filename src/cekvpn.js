const WILDCARD_MAP = {
  ava: "ava.game.naver.com",
  api: "api.midtrans.com"
};

const WILDCARD_OPTIONS = Object.entries(WILDCARD_MAP).map(([value, text]) => ({ text, value }));

let tempData = {};

export async function fetchIPData(ip, port, API_URL) {
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
    { text: `🔅 ${index + 1}. ${option.text}`, callback_data: `WILDCARD|${protocol}|${ip}|${port}|${option.value}` },
  ]);
  
  buttons.push([{ text: "🔙 Kembali", callback_data: `BACK|${ip}|${port}` }]);

  return { inline_keyboard: buttons };
}

export function generateConfig(config, protocol, DEFAULT_HOST, wildcardKey = null) {
  if (!config || !config.ip || !config.port || !config.isp) {
    return "❌ Data tidak valid!";
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

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
  const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';
  
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
      host: host,
      path: pathh,
      tls: "tls",
      sni: sni,
      scy: "zero"
    };

    const vmessNTLS = {
      ...vmessTLS,
      port: "80",
      tls: "none",
      ps: "[VMess-NTLS]"
    };

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

  if (protocol === "VLESS") {
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

  if (protocol === "TROJAN") {
    const configString1 = `trojan://${uuid}@${host}:443?security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
    const configString2 = `trojan://${uuid}@${host}:80?path=${path}&security=none&encryption=none&host=${host}&fp=randomized&type=ws&sni=${host}#${ispEncoded}`;

    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configString1)}&size=200x200`;

    return `
\`\`\`TROJAN-TLS
${configString1}
\`\`\`\`\`\`TROJAN-NTLS
${configString2}
\`\`\`
               👉 [QR Code URL](${qrUrl})
               
           🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
           
    👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
  `;
  }

  if (protocol === "SHADOWSOCKS") {
    const configString1 = `ss://${toBase64(`none:${uuid}`)}@${host}:443?encryption=none&type=ws&host=${host}&path=${path}#${ispEncoded}`;
    const configString2 = `ss://${toBase64(`none:${uuid}`)}@${host}:80?encryption=none&type=ws&host=${host}&path=${path}#${ispEncoded}`;

    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configString1)}&size=200x200`;

    return `
\`\`\`SHADOWSOCKS-TLS
${configString1}
\`\`\`
\`\`\`SHADOWSOCKS-NTLS
${configString2}
\`\`\`

👉 [QR Code URL](${qrUrl})

🌍 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
  }

  return "Protocol tidak dikenali.";
}

export async function handleIpMessage({ chatId, text, send, edit, API_URL, DEFAULT_HOST }) {
  const ipPortPattern = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/;
  const match = text.match(ipPortPattern);

  if (match) {
    const ip = match[1];
    const port = match[2];

    if (tempData[chatId]) {
      // Jika sudah ada data sebelumnya, hapus dulu agar tidak bentrok
      delete tempData[chatId];
    }

    const data = await fetchIPData(ip, port, API_URL);
    if (!data || data.status !== "success") {
      await send(chatId, "❌ IP/Port tidak valid atau API gagal merespon.");
      return;
    }

    tempData[chatId] = data;
    await send(chatId, `Pilih protocol:`, {
      reply_markup: createProtocolInlineKeyboard(ip, port)
    });
  }
}

export { tempData, WILDCARD_MAP };
