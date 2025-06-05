
export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

/**
 * Kelas TelegramCekkuota: menangani webhook Telegram dalam stateless Cloudflare Worker
 */
export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.sendMessage = this.sendMessage.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  /**
   * Kirim pesan ke chatId tertentu
   */
  async sendMessage(chatId, text, opts = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...opts };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  /**
   * Handler untuk setiap update Telegram
   */
  async handleUpdate(update) {
    // Hanya tangani jika ada pesan teks
    if (!update.message || !update.message.text) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text   = update.message.text.trim();

    // 1) Jika user kirim perintah /cekkuota → kirim prompt
    if (text === '/cekkuota') {
      await this.sendMessage(
        chatId,
        '📌 *Masukkan nomor HP, 1 nomor per baris.*\nMaksimal *20* nomor.\n\nKirim nomor sekarang.',
        { parse_mode: 'Markdown' }
      );
      return new Response('OK', { status: 200 });
    }

    // 2) Jika text bukan perintah (tidak diawali slash), anggap daftar nomor
    if (!text.startsWith('/')) {
      // Pecah per baris, buang yang kosong
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      // Validasi jumlah
      if (lines.length > 20) {
        await this.sendMessage(
          chatId,
          '⚠️ Maksimal 20 nomor saja. Silakan kirim ulang daftar nomor HP.',
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }
      // Validasi format tiap nomor
      const invalid = lines.filter(n => !/^0\d{6,15}$/.test(n));
      if (invalid.length) {
        await this.sendMessage(
          chatId,
          `⚠️ Nomor tidak valid:\n${invalid.join('\n')}\n\nSilakan kirim ulang dengan format benar.`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      // Loading
      await this.sendMessage(chatId, `⏳ Memproses ${lines.length} nomor, mohon tunggu...`);

      // Proses tiap nomor
      let result = '';
      for (const num of lines) {
        result += await _cekkuota(num) + '\n\n';
      }

      // Kirim hasil
      await this.sendMessage(
        chatId,
        result.trim(),
        { parse_mode: 'Markdown' }
      );
      return new Response('OK', { status: 200 });
    }

    // 3) Abaikan perintah lain
    return new Response('OK', { status: 200 });
  }
}

/**
 * Helper: fetch data kuota dan format ke string Markdown
 */
async function _cekkuota(number) {
  try {
    const url = `https://dompul.free-accounts.workers.dev/?number=${number}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    const json = await res.json();
    const sp = json.data?.data_sp;
    if (!sp) return `❌ Gagal mendapatkan data untuk *${number}*.`;

    let out = [
      `📌 *Info Pelanggan:*`,
      `🔢 Nomor: ${number}`,
      `⌛️ Umur Kartu: ${sp.active_card?.value || '-'}`,
      `📶 Status Simcard: ${sp.status_4g?.value || '-'}`,
      `📋 Status Dukcapil: ${sp.dukcapil?.value || '-'}`,
      `⏳ Masa Aktif: ${sp.active_period?.value || '-'}`
    ].join('\n');

    out += `\n\n📦 *Paket Aktif:*`;
    if (sp.quotas?.success && Array.isArray(sp.quotas.value)) {
      for (const grp of sp.quotas.value) {
        for (const pkg of grp) {
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

