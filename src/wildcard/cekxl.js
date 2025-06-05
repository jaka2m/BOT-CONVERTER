export async function Cekkuota(link) {
  console.log("Bot link:", link);
  // Bisa ditambahkan logic lain kalau perlu
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.waitingForNumbers = new Set();
  }

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

  async handleUpdate(update) {
    console.log("Received update:", JSON.stringify(update));  // DEBUG

    if (!update.message) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    console.log(`ChatId: ${chatId} | Text: "${text}"`);  // DEBUG

    if (text === '/cekkuota') {
      this.waitingForNumbers.add(chatId);
      console.log(`Added chatId ${chatId} to waitingForNumbers`); // DEBUG

      await this.sendMessage(
        chatId,
        '📌 *Masukkan nomor HP, 1 nomor per baris.*\nMaksimal *20* nomor.',
        'Markdown'
      );

      return new Response('OK', { status: 200 });
    }

    if (this.waitingForNumbers.has(chatId)) {
      console.log(`ChatId ${chatId} is in waitingForNumbers, processing input...`); // DEBUG

      if (text === '/cekkuota') {
        // Jika user kirim /cekkuota lagi tanpa input nomor, abaikan saja.
        console.log(`ChatId ${chatId} sent /cekkuota again while waiting, ignoring.`);
        return new Response('OK', { status: 200 });
      }

      // Hapus chatId dari waiting state sebelum proses agar tidak terjebak
      this.waitingForNumbers.delete(chatId);
      console.log(`Removed chatId ${chatId} from waitingForNumbers`); // DEBUG

      // Proses input nomor
      const inputLines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (inputLines.length > 20) {
        await this.sendMessage(
          chatId,
          '⚠️ Maksimal 20 nomor saja. Silakan kirim ulang daftar nomor HP.',
          'Markdown'
        );
        return new Response('OK', { status: 200 });
      }

      // Validasi format nomor (harus diawali 0 dan 7-16 digit)
      const invalidNumbers = inputLines.filter(num => !/^0\d{6,15}$/.test(num));
      if (invalidNumbers.length > 0) {
        await this.sendMessage(
          chatId,
          `⚠️ Ada nomor tidak valid:\n${invalidNumbers.join('\n')}\n\nSilakan kirim ulang dengan format benar.`,
          'Markdown'
        );
        return new Response('OK', { status: 200 });
      }

      await this.sendMessage(
        chatId,
        `⏳ Memproses ${inputLines.length} nomor, mohon tunggu...`,
        'Markdown'
      );

      let hasilAkhir = '';
      for (const number of inputLines) {
        const cek = await _cekkuota(number);
        hasilAkhir += `\n${cek}\n`;
      }

      await this.sendMessage(chatId, hasilAkhir, 'Markdown');

      return new Response('OK', { status: 200 });
    }

    // Kalau tidak ada command yang cocok, tetap balas OK supaya bot tidak error
    return new Response('OK', { status: 200 });
  }
}

// Fungsi cek kuota dummy, sesuaikan sesuai kebutuhan
async function _cekkuota(number) {
  try {
    // Contoh request ke API eksternal
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    };

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!data.data?.data_sp) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }

    const dataSp = data.data.data_sp;

    let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${number}
⌛️ *Umur Kartu:* ${dataSp.active_card?.value || '-'}
📶 *Status Simcard:* ${dataSp.status_4g?.value || '-'}
📋 *Status Dukcapil:* ${dataSp.dukcapil?.value || '-'}
⏳ *Masa Aktif:* ${dataSp.active_period?.value || '-'}`;

    let infoPaket = `\n📦 *Paket Aktif:*\n`;

    if (dataSp.quotas?.success && Array.isArray(dataSp.quotas.value)) {
      for (const paketGroup of dataSp.quotas.value) {
        for (const paket of paketGroup) {
          const namaPaket = paket.packages?.name || paket.name || '-';
          const masaAktif = paket.packages?.expDate || paket.date_end || '-';

          infoPaket += `
🎁 *Nama Paket:* ${namaPaket}
📅 *Masa Aktif:* ${masaAktif}`;

          const details = paket.detail_quota || paket.benefits || [];
          if (Array.isArray(details) && details.length > 0) {
            for (const detail of details) {
              const benefitName = detail.name || detail.bname || '-';
              const tipe = detail.type || '-';
              const kuota = detail.total_text || detail.quota || '-';
              const sisa = detail.remaining_text || detail.remaining || '-';

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
