export async function randomip() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');

    if (ipList.length === 0) {
      return '❌ Tidak ada IP yang tersedia.';
    }

    // Ambil maksimal 20 IP secara acak
    const shuffled = ipList.sort(() => 0.5 - Math.random());
    const selectedIPs = shuffled.slice(0, 20);

    let resultText = `🔑 *Here are ${selectedIPs.length} random Proxy IPs:*\n\n`;
    selectedIPs.forEach(line => {
      const [ip, port, code, isp] = line.split(',');
      resultText += `📍 *IP:PORT* : \`${ip}:${port}\`\n`;
      resultText += `🌐 *Country* : ${code} ${getFlagEmoji(code)}\n`;
      resultText += `💻 *ISP* : ${isp}\n\n`;
    });

    return resultText;
  } catch (error) {
    return '❌ Gagal mengambil data IP.';
  }
}

// Fungsi tambahan untuk mengubah kode negara jadi emoji bendera
function getFlagEmoji(countryCode = '') {
  const code = countryCode.trim().toUpperCase();
  return code.length === 2
    ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';
}
