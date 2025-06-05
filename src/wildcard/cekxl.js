// worker.js

// ===============================
// 1. Stub Cekkuota(link) untuk demo
// ===============================
export async function Cekkuota(link) {
  console.log("Bot link:", link);
  // Anda bisa menambahkan logika lain di sini jika diperlukan
}

// ===============================
// 2. Kelas TelegramCekkuota
// ===============================
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.waitingForNumbers = new Set();  // chatId yang menunggu input

    // Bind supaya `this` tetap ke instance
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  // helper untuk kirim pesan
  async sendMessage(chatId, text, opts = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...opts };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // handler utama untuk setiap update
  async handleUpdate(update) {
    try {
      // hanya tangani message
      if (!update.message) {
        return new Response('OK', { status: 200 });
      }

      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();
      console.log('Got message:', text, 'from', chatId);

      // 1) user kirim perintah /cekkuota
      if (text === '/cekkuota') {
        this.waitingForNumbers.add(chatId);
        await this.sendMessage(chatId,
          '📌 *Masukkan nomor HP, 1 nomor per baris.*\nMaksimal *20* nomor.',
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      // 2) jika sedang menunggu nomor, proses input
      if (this.waitingForNumbers.has(chatId)) {
        this.waitingForNumbers.delete(chatId);

        // abaikan jika user tidak benar-benar menginput nomor
        if (text === '/cekkuota') {
          return new Response('OK', { status: 200 });
        }

        // parse nomor per baris
        const numbers = text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l);

        // validasi jumlah
        if (numbers.length > 20) {
          await this.sendMessage(chatId,
            '⚠️ Maksimal 20 nomor saja. Silakan kirim ulang daftar nomor HP.',
            { parse_mode: 'Markdown' }
          );
          return new Response('OK', { status: 200 });
        }

        // validasi format nomor: awalan 0, 7–16 digit
        const invalid = numbers.filter(n => !/^0\d{6,15}$/.test(n));
        if (invalid.length) {
          await this.sendMessage(chatId,
            `⚠️ Nomor tidak valid:\n${invalid.join('\n')}\n\nSilakan kirim ulang dengan format benar.`,
            { parse_mode: 'Markdown' }
          );
          return new Response('OK', { status: 200 });
        }

        // kirim loading
        await this.sendMessage(chatId,
          `⏳ Memproses ${numbers.length} nomor, mohon tunggu...`
        );

        // loop cek kuota tiap nomor
        let reply = '';
        for (const num of numbers) {
          reply += await _cekkuota(num) + '\n\n';
        }

        // kirim hasil
        await this.sendMessage(chatId, reply.trim(), { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      // jika bukan perintah kita, abaikan
      return new Response('OK', { status: 200 });

    } catch (err) {
      console.error('Error in handleUpdate:', err);
      return new Response('OK', { status: 200 });
    }
  }
}

// ========================================
// 3. Helper function: fetch & format kuota
// ========================================
async function _cekkuota(number) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    const data = await res.json();
    const sp = data.data?.data_sp;
    if (!sp) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }

    // Info pelanggan
    let out = [
      `📌 *Info Pelanggan:*`,
      `🔢 Nomor: ${number}`,
      `⌛️ Umur Kartu: ${sp.active_card?.value || '-'}`,
      `📶 Status Simcard: ${sp.status_4g?.value || '-'}`,
      `📋 Status Dukcapil: ${sp.dukcapil?.value || '-'}`,
      `⏳ Masa Aktif: ${sp.active_period?.value || '-'}`
    ].join('\n');

    // Paket aktif
    out += `\n\n📦 *Paket Aktif:*`;
    if (sp.quotas?.success && Array.isArray(sp.quotas.value)) {
      for (const group of sp.quotas.value) {
        for (const pkg of group) {
          const name = pkg.packages?.name || pkg.name || '-';
          const exp  = pkg.packages?.expDate || pkg.date_end || '-';
          out += `\n\n🎁 *Nama Paket:* ${name}\n📅 Masa Aktif: ${exp}`;

          const details = pkg.detail_quota || pkg.benefits || [];
          if (details.length) {
            for (const d of details) {
              const bname = d.name || d.bname || '-';
              const tipe  = d.type || '-';
              const q     = d.total_text || d.quota || '-';
              const rem   = d.remaining_text || d.remaining || '-';
              out += `\n  ─ 📌 *Benefit:* ${bname}\n     🧧 Tipe: ${tipe}\n     💾 Kuota: ${q}\n     ✅ Sisa: ${rem}`;
            }
          } else {
            out += `\n  🚫 Tidak ada detail benefit.`;
          }
        }
      }
    } else {
      out += `\n\n🚫 Tidak ada paket aktif.`;
    }

    return out;
  } catch (e) {
    return `❌ Error cek *${number}*: ${e.message}`;
  }
}

