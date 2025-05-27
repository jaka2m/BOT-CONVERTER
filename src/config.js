export async function rotateconfig(chatId, text) {
  const command = text.trim();
  const args = command.split(" ");
  if (args.length !== 2) {
    await this.sendMessage(chatId, `⚠️ *Format salah! Gunakan contoh berikut:*\n\`/rotate id\``, {
      parse_mode: "Markdown",
    });
    return;
  }

  const countryCode = args[1].toLowerCase();
  const validCountries = [
    "id", "sg", "my", "us", "ca", "in", "gb", "ir", "ae", "fi", "tr", "md", "tw", "ch", "se",
    "nl", "es", "ru", "ro", "pl", "al", "nz", "mx", "it", "de", "fr", "am", "cy", "dk", "br",
    "kr", "vn", "th", "hk", "cn", "jp",
  ];

  if (!validCountries.includes(countryCode)) {
    await this.sendMessage(chatId, `⚠️ *Kode negara tidak valid! Gunakan kode yang tersedia.*`, {
      parse_mode: "Markdown",
    });
    return;
  }

  // Kirim pesan loading
  const loadingMessage = await this.sendMessage(chatId, "⏳ Sedang memproses config...");

  try {
    const response = await fetch("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
    const ipText = await response.text();
    const ipList = ipText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "");

    const filteredIpList = ipList
      .map(line => line.split(","))
      .filter(parts => parts.length >= 4 && parts[2].toLowerCase() === countryCode);

    if (filteredIpList.length === 0) {
      await this.sendMessage(chatId, `⚠️ *Tidak ada IP untuk negara ${countryCode.toUpperCase()}*`, {
        parse_mode: "Markdown"
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }

    const [ip, port, country, provider] = filteredIpList[Math.floor(Math.random() * filteredIpList.length)];

    const statusResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    const ipData = await statusResponse.json();

    if (ipData.status !== "ACTIVE") {
      await this.sendMessage(chatId, `⚠️ *IP ${ip}:${port} tidak aktif.*`, {
        parse_mode: "Markdown",
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }

    // Helper functions
    const getFlagEmoji = (code) => code.toUpperCase().split("").map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
    const generateUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    
    const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
    
    // Ganti dengan hostname server kamu
    const HOSTKU = "example.com";

    const flag = getFlagEmoji(countryCode);
    const path = `/Geo-Project/${ip}-${port}`;
    const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';

    const vmessTLS = {
      v: "2",
      ps: `${countryCode.toUpperCase()} ${flag} [VMess-TLS]`,
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
      ps: `${countryCode.toUpperCase()} ${flag} [VMess-NTLS]`,
      port: "80",
      tls: "none"
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

    await this.sendMessage(chatId, configText, { parse_mode: "Markdown" });
    await this.deleteMessage(chatId, loadingMessage.result.message_id);

  } catch (error) {
    console.error(error);
    await this.sendMessage(chatId, `⚠️ Terjadi kesalahan: ${error.message}`);
    await this.deleteMessage(chatId, loadingMessage.result.message_id);
  }
}
