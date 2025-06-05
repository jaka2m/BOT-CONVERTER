/**
 * cekkuota.js
 *
 * Modul ini menyediakan:
 * 1. Fungsi `Cekkuota(link)` (dummy)
 * 2. Kelas `TelegramCekkuota` untuk menangani webhook Telegram
 *    dengan perintah `/cekkuota` yang meminta user memasukkan daftar
 *    nomor HP (1 per baris, maksimal 20), kemudian memproses pengecekan kuota.
 */

// ===============================
// 1. Fungsi dummy: Cekkuota(link)
// ===============================
export async function Cekkuota(link) {
  console.log("Bot link:", link);
  // (Anda bisa menambahkan logika lain di sini jika diperlukan)
}


// ==================================================
// 2. Class TelegramCekkuota
//    - handleUpdate(update): menangani webhook Telegram
//    - sendMessage(chatId, text): kirim pesan ke chat Telegram
// ==================================================
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    // Set untuk melacak chatId yang sedang menunggu input daftar nomor
    this.waitingForNumbers = new Set();
  }

  // -----------------------
  // 2.1. Kirim pesan ke Telegram
  // -----------------------
  async sendMessage(chatId, text, parseMode = 'Markdown') {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;

    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // -----------------------
  // 2.2. Handler untuk setiap update webhook
  //      - Jika user mengirim "/cekkuota", bot akan meminta daftar nomor
  //      - Jika chatId sudah tercatat di waitingForNumbers, 
  //        pesan berikutnya dianggap daftar nomor untuk diproses
  // -----------------------
  async handleUpdate(update) {
    // Jika bukan message, abaikan
    if (!update.message) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    // -----------------------
    // Jika user mengirim "/cekkuota"
    // -----------------------
    if (text === '/cekkuota') {
      // Tandai chat ini sedang menunggu daftar nomor
      this.waitingForNumbers.add(chatId);

      // Kirim prompt instruksi
      await this.sendMessage(
        chatId,
        '📌 *Masukkan nomor HP, 1 nomor per baris.*\nMaksimal *20* nomor.',
        'Markdown'
      );

      return new Response('OK', { status: 200 });
    }

    // -----------------------
    // Jika chat ini sedang menunggu input daftar nomor
    // -----------------------
    if (this.waitingForNumbers.has(chatId)) {
      // Hapus chatId dari state "menunggu"
      this.waitingForNumbers.delete(chatId);

      // Jika user kembali mengirim "/cekkuota" sebagai teks kedua, abaikan
      if (text === '/cekkuota') {
        return new Response('OK', { status: 200 });
      }

      // Pecah input per baris, hapus baris kosong
      const inputLines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Validasi jumlah baris (maksimal 20)
      if (inputLines.length > 20) {
        await this.sendMessage(
          chatId,
          '⚠️ Maksimal 20 nomor saja. Silakan kirim ulang daftar nomor HP.',
          'Markdown'
        );
        return new Response('OK', { status: 200 });
      }

      // Validasi format tiap nomor: harus diawali "0" dan panjang 7–16 digit
      const invalidNumbers = inputLines.filter(num => !/^0\d{6,15}$/.test(num));
      if (invalidNumbers.length > 0) {
        await this.sendMessage(
          chatId,
          `⚠️ Ada nomor tidak valid:\n${invalidNumbers.join('\n')}\n\nSilakan kirim ulang dengan format benar.`,
          'Markdown'
        );
        return new Response('OK', { status: 200 });
      }

      // Kirim pesan loading
      await this.sendMessage(
        chatId,
        `⏳ Memproses ${inputLines.length} nomor, mohon tunggu...`,
        'Markdown'
      );

      // Proses cek kuota per nomor
      let hasilAkhir = '';
      for (const number of inputLines) {
        const cek = await _cekkuota(number);
        hasilAkhir += `\n${cek}\n`;
      }

      // Kirim seluruh hasil cek kuota (satu kali kirim)
      await this.sendMessage(chatId, hasilAkhir, 'Markdown');

      return new Response('OK', { status: 200 });
    }

    // Jika bukan perintah /cekkuota dan tidak menunggu daftar nomor, abaikan
    return new Response('OK', { status: 200 });
  }
}


// ==================================================
// 3. Fungsi helper: _cekkuota(number) → string Markdown
//    Menghubungi endpoint Workers (JSON) untuk mengambil data kuota.
// ==================================================
async function _cekkuota(number) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    };

    const response = await fetch(url, { headers });
    const data = await response.json();

    // Jika tidak ada objek data_sp → return error per nomor
    if (!data.data?.data_sp) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }

    const dataSp = data.data.data_sp;
    // 3.1. Rangkuman Info Pelanggan
    let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${number}
⌛️ *Umur Kartu:* ${dataSp.active_card?.value || '-'}
📶 *Status Simcard:* ${dataSp.status_4g?.value || '-'}
📋 *Status Dukcapil:* ${dataSp.dukcapil?.value || '-'}
⏳ *Masa Aktif:* ${dataSp.active_period?.value || '-'}`;

    // 3.2. Rangkuman Paket Aktif
    let infoPaket = `\n📦 *Paket Aktif:*\n`;

    if (dataSp.quotas?.success && Array.isArray(dataSp.quotas.value)) {
      // Struktur dataSp.quotas.value adalah array of array paket
      for (const paketGroup of dataSp.quotas.value) {
        for (const paket of paketGroup) {
          // Beberapa struktur paket bisa berbeda: 
          // - paket.packages.name  atau  paket.name
          // - masa aktif ada di paket.packages.expDate atau paket.date_end
          const namaPaket = paket.packages?.name || paket.name || '-';
          const masaAktif = paket.packages?.expDate || paket.date_end || '-';

          infoPaket += `
🎁 *Nama Paket:* ${namaPaket}
📅 *Masa Aktif:* ${masaAktif}`;

          // Cek detail benefit: bisa ada di paket.detail_quota atau paket.benefits
          const details = paket.detail_quota || paket.benefits || [];
          if (Array.isArray(details) && details.length > 0) {
            for (const detail of details) {
              const benefitName = detail.name || detail.bname || '-';
              const tipe        = detail.type || '-';
              const kuota       = detail.total_text || detail.quota || '-';
              const sisa        = detail.remaining_text || detail.remaining || '-';

              infoPaket += `
  ─ 📌 *Benefit:* ${benefitName}
     🧧 *Tipe:* ${tipe}
     💾 *Kuota:* ${kuota}
     ✅ *Sisa:* ${sisa}`;
            }
          } else {
            infoPaket += `\n  🚫 Tidak ada detail benefit.`;
          }

          infoPaket += `\n-----------------------------`;
        }
      }
    } else {
      infoPaket += `Tidak ada paket aktif.`;
    }

    return infoPelanggan + infoPaket;
  } catch (err) {
    return `❌ Terjadi kesalahan saat memeriksa nomor *${number}*.\nError: ${err.message}`;
  }
}
