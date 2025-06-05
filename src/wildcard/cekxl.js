export async function Cekkuota(nomor) {
  console.log("Cekkuota: nomor =", nomor);
  const url = `https://dompul.free-accounts.workers.dev/?number=${nomor}`;

  const headers = {
    'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
    'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
    'X-App-Version': '4.0.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Referer': 'https://dompul.free-accounts.workers.dev/'
  };

  try {
    const response = await fetch(url, { headers });
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

    const text = await response.text();
    console.log('Response body:', text);

    if (!response.ok) {
      if (text.includes('1042')) {
        return '❌ Nomor tidak ditemukan atau diblokir.';
      }
      return `❌ Error dari API: HTTP ${response.status} - ${response.statusText}`;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return `❌ Server mengembalikan format tidak dikenal: ${text}`;
    }

    const data = JSON.parse(text);

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
  } catch (error) {
    console.error('Fetch error:', error);
    return `❌ Gagal memproses permintaan: ${error.message}`;
  }
}
