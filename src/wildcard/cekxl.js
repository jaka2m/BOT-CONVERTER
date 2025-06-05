// worker.js

// ===============================
// 1. Stub fungsi Cekkuota(link) — hanya logging
// ===============================
export async function Cekkuota(link) {
  console.log("Bot link:", link);
  // (Anda bisa menambahkan logika lain di sini jika diperlukan)
}

// ===============================
// 2. Helper function untuk cek kuota tiap nomor
// ===============================
async function _cekkuota(number) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    // Clone agar bisa baca body dua kali saat error parse
    const clonedRes = res.clone();

    let data;
    try {
      data = await res.json();
    } catch (err) {
      const text = await clonedRes.text();
      return `❌ Gagal cek *${number}*:\n\`\`\`\n${text}\n\`\`\``;
    }

    if (!data || !data.nomor) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }

    // Mulai membangun pesan output
    let out = [
      `📲 *Cek Nomor:* ${data.nomor}`,
      `🏷️ *Provider:* ${data.provider || '-'}`,
      `📅 *Umur Kartu:* ${data.umur_kartu || '-'}`,
      `📶 *Status SIM:* ${data.status_simcard || '-'}`,
      `🆔 *Status Dukcapil:* ${data.status_dukcapil || '-'}`,
      `🗓️ *Masa Aktif:* ${data.masa_aktif || '-'}`,
      `⏳ *Masa Tenggang:* ${data.masa_tenggang || '-'}`
    ].join('\n');

    // Paket aktif
    if (Array.isArray(data.paket_aktif) && data.paket_aktif.length > 0) {
      out += `\n\n📦 *Paket Aktif:*`;
      data.paket_aktif.forEach((paket, idx) => {
        out += `\n\n${idx + 1}. 🎁 *${paket.nama_paket}*`;
        out += `\n   📆 *Masa Aktif:* ${paket.masa_aktif || '-'}`;
        if (Array.isArray(paket.benefits) && paket.benefits.length > 0) {
          paket.benefits.forEach(b => {
            out += `\n     ▫️ ${b}`;
          });
        } else {
          out += `\n     🚫 Tidak ada benefit detail.`;
        }
      });
    } else {
      out += `\n\n🚫 Tidak ada paket aktif.`;
    }

    return out;

  } catch (e) {
    return `❌ Error cek *${number}*: ${e.message}`;
  }
}
