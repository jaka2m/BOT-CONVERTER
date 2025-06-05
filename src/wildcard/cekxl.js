export async function Cekkuota(link) {
  console.log("Bot link:", link);
  const url = `https://dompul.free-accounts.workers.dev/?number=${link}`;

  const headers = {
    'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
    'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
    'X-App-Version': '4.0.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Referer': 'https://dompul.free-accounts.workers.dev/'
  };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text();
    if (text.includes('1042')) {
      return '❌ Nomor tidak ditemukan atau diblokir.';
    }
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`❌ Server mengembalikan format tidak dikenal: ${text}`);
  }

  const data = await response.json();

  if (!data.nomor) {
    return '❌ Data tidak ditemukan atau nomor tidak valid.';
  }

  let pesan = `📱 *Nomor:* ${data.nomor}\n`;
  pesan += `📡 *Provider:* ${data.provider}\n`;
  pesan += `📅 *Umur Kartu:* ${data.umur_kartu}\n`;
  pesan += `📶 *Status SIM:* ${data.status_simcard}\n`;
  pesan += `📇 *Dukcapil:* ${data.status_dukcapil}\n`;
  pesan += `📆 *Masa Aktif:* ${data.masa_aktif}\n`;
  pesan += `⏳ *Masa Tenggang:* ${data.masa_tenggang}\n\n`;
  pesan += `📦 *Paket Aktif:*\n`;

  data.paket_aktif.forEach((paket, i) => {
    pesan += ` ${i + 1}. ${paket.nama_paket}\n    Aktif sampai: ${paket.masa_aktif}\n`;
  });

  return pesan;
}
}
