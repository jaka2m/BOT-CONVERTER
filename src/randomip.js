// randomip.js

const ipDetailsMap = new Map();

export function getFlagEmoji(countryCode = '') {
  const code = countryCode.trim().toUpperCase();
  return code.length === 2
    ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';
}

export async function randomip(userId) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');

    if (ipList.length === 0) {
      return { text: '❌ Tidak ada IP yang tersedia.', buttons: [] };
    }

    const shuffled = ipList.sort(() => 0.5 - Math.random());
    const selectedIPs = shuffled.slice(0, 20);

    let text = `🔑 *Here are ${selectedIPs.length} random Proxy IPs:*\n\nTekan bendera untuk detail:\n`;
    const buttons = [];
    const detailsByCountry = {};

    selectedIPs.forEach(line => {
      const [ip, port, code, isp] = line.split(',');
      const flag = getFlagEmoji(code);

      const detail = `📍 *IP:PORT*: \`${ip}:${port}\`\n🌐 *Country*: ${code} ${flag}\n💻 *ISP*: ${isp}`;
      if (!detailsByCountry[code]) {
        detailsByCountry[code] = [];
      }
      detailsByCountry[code].push(detail);
    });

    for (const code in detailsByCountry) {
      buttons.push([{
        text: getFlagEmoji(code),
        callback_data: `DETAIL_${code}`
      }]);
    }

    ipDetailsMap.set(userId, detailsByCountry);

    return { text, buttons };
  } catch (error) {
    return { text: '❌ Gagal mengambil data IP.', buttons: [] };
  }
}

export function getIpDetail(userId, countryCode) {
  const map = ipDetailsMap.get(userId);
  if (!map) return null;
  return map[countryCode] || null;
}
