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

  const loadingMessage = await this.sendMessage(chatId, "⏳ Sedang memproses config...");

  try {
    const response = await fetch("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
    const ipText = await response.text();
    const ipList = ipText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "");

    if (ipList.length === 0) {
      await this.sendMessage(chatId, `⚠️ *Tidak ada IP untuk negara ${countryCode.toUpperCase()}*`, {
        parse_mode: "Markdown"
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }

    const [ip, port, country, provider] = ipList[Math.floor(Math.random() * ipList.length)].split(",");

    if (!ip || !port) {
      await this.sendMessage(chatId, `⚠️ Data IP atau Port tidak lengkap dari daftar proxy.`, {
        parse_mode: "Markdown",
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }

    const statusResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    const ipData = await statusResponse.json();

    if (ipData.status !== "ACTIVE") {
      await this.sendMessage(chatId, `⚠️ *IP ${ip}:${port} tidak aktif.*`, {
        parse_mode: "Markdown",
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }

    const getFlagEmoji = (code) => code.toUpperCase().split("").map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
    const generateUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    
    const toBase64 = (str) => typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, 'utf-8').toString('base64');
    
    const HOSTKU = "gamang.gpj1.dpdns.org";
    const path = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;

    // Meng-encode seluruh string label termasuk TLS/NTLS
    const encodedVlessLabelTLS = encodeURIComponent(`ROTATE VLESS ${ipData.isp} ${ipData.country} TLS`);
    const encodedVlessLabelNTLS = encodeURIComponent(`ROTATE VLESS ${ipData.isp} ${ipData.country} NTLS`);
    const encodedTrojanLabelTLS = encodeURIComponent(`ROTATE TROJAN ${ipData.isp} ${ipData.country} TLS`);
    const encodedSsLabelTLS = encodeURIComponent(`ROTATE SHADOWSOCKS ${ipData.isp} ${ipData.country} TLS`);
    const encodedSsLabelNTLS = encodeURIComponent(`ROTATE SHADOWSOCKS ${ipData.isp} ${ipData.country} NTLS`);

    const configText = `
\`\`\`INFORMATION
IP      : ${ip}
PORT    : ${port}
ISP     : ${provider}
COUNTRY : ${ipData.country}
STATUS  : ${ipData.status}
\`\`\`
🌟 *ROTATE VLESS TLS* 🌟
\`\`\`
vless://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodedVlessLabelTLS}
\`\`\`
🌟 *ROTATE VLESS NTLS* 🌟
\`\`\`
vless://${generateUUID()}@${HOSTKU}:80?path=${encodeURIComponent(path)}&security=none&encryption=none&host=${HOSTKU}&fp=randomized&type=ws&sni=${HOSTKU}#${encodedVlessLabelNTLS}
\`\`\`
🌟 *ROTATE TROJAN TLS* 🌟
\`\`\`
trojan://${generateUUID()}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodedTrojanLabelTLS}
\`\`\`
🌟 *ROTATE SS TLS* 🌟
\`\`\`
ss://${toBase64(`none:${generateUUID()}`)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}&security=tls&sni=${HOSTKU}#${encodedSsLabelTLS}
\`\`\`
🌟 *ROTATE SS NTLS* 🌟
\`\`\`
ss://${toBase64(`none:${generateUUID()}`)}@${HOSTKU}:80?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}&security=none&sni=${HOSTKU}#${encodedSsLabelNTLS}
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
