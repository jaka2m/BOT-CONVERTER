
export async function Cekkuota(number) {
  console.log("cek kuota:", number);
  try {
    const url = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${number}&isJSON=true`;
    const headers = {
      'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
      'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
      'X-App-Version': '4.0.0',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const response = await fetch(url, { headers });
    const data = await response.json();
    const dataSp = data?.data?.data_sp;
    if (!dataSp) {
      return `❌ Gagal mendapatkan data untuk *${number}*.`;
    }
    let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${number}
🏷️ *Provider:* ${dataSp.prefix?.value || '-'}
⌛️ *Umur Kartu:* ${dataSp.active_card?.value || '-'}
📶 *Status Simcard:* ${dataSp.status_4g?.value || '-'}
📋 *Status Dukcapil:* ${dataSp.dukcapil?.value || '-'}
⏳ *Masa Aktif:* ${dataSp.active_period?.value || '-'}
⚠️ *Masa Tenggang:* ${dataSp.grace_period?.value || '-'}`;

    let infoPaket = `\n\n📦 *Paket Aktif:*\n`;
    if (dataSp.quotas?.success && Array.isArray(dataSp.quotas.value)) {
      for (const paketGroup of dataSp.quotas.value) {
        for (const paket of paketGroup) {
          const pkg = paket.packages;
          const benefits = paket.benefits;
          infoPaket += `
🎁 *Nama Paket:* ${pkg.name}
📅 *Masa Aktif:* ${pkg.expDate}`;
          if (benefits && benefits.length > 0) {
            for (const benefit of benefits) {
              infoPaket += `
  ─ 📌 *Benefit:* ${benefit.bname}
     🧧 *Tipe:* ${benefit.type}
     💾 *Kuota:* ${benefit.quota}
     ✅ *Sisa:* ${benefit.remaining}`;
            }
          } else {
            infoPaket += `
  🚫 Tidak ada detail benefit.`;
          }
          infoPaket += `\n-----------------------------\n`;
        }
      }
    } else {
      infoPaket += `❌ Tidak ada paket aktif.`;
    }
    return infoPelanggan + infoPaket;
  } catch (error) {
    console.error("Gagal cek kuota:", error);
    return `❌ *Terjadi kesalahan saat memeriksa nomor ${number}.*`;
  }
}

export class TelegramCekkuotaBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.offset = 0; // update offset for getUpdates polling
    this.running = false;
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...options
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async getUpdates() {
    const url = `${this.apiUrl}/bot${this.token}/getUpdates?offset=${this.offset + 1}&timeout=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      this.offset = data.result[data.result.length - 1].update_id;
    }
    return data.result;
  }

  async start() {
    this.running = true;
    console.log("Bot started...");
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          if (!update.message || !update.message.text) continue;
          const chatId = update.message.chat.id;
          const text = update.message.text.trim();
          const messageThreadId = update.message.message_thread_id;

          if (text.startsWith('/cekkuota')) {
            await this.sendMessage(chatId, "📌 Silakan masukkan nomor yang ingin dicek (bisa lebih dari satu, pisahkan dengan spasi atau baris baru):", { message_thread_id: messageThreadId });

            // Wait for next message from same user
            const numbers = await this.waitForNumbers(chatId);

            if (numbers.length === 0) {
              await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).", { message_thread_id: messageThreadId });
              continue;
            }

            const loadingMsg = await this.sendMessage(chatId, `⏳ Sedang memproses ${numbers.length} nomor, harap tunggu...`, { message_thread_id: messageThreadId });

            let hasilAkhir = '';
            for (const number of numbers) {
              const result = await Cekkuota(number);
              hasilAkhir += `${result}\n\n`;
            }

            // Try edit loading message with result, fallback send new message
            try {
              await this.editMessageText(chatId, loadingMsg.result.message_id, hasilAkhir.trim(), { message_thread_id: messageThreadId });
            } catch {
              await this.sendMessage(chatId, hasilAkhir.trim(), { message_thread_id: messageThreadId });
            }
          }
        }
      } catch (error) {
        console.error('Error in main loop:', error);
      }
    }
  }

  async waitForNumbers(chatId) {
    // Simple polling for next message from same chat within 60 seconds
    const timeoutMs = 60000;
    const pollIntervalMs = 1500;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const updates = await this.getUpdates();
      for (const update of updates) {
        if (!update.message || !update.message.text) continue;
        if (update.message.chat.id !== chatId) continue;

        const inputText = update.message.text.trim();
        // Validate numbers: start with 0 + 6-15 digits
        const numbers = inputText.split(/[\s.\n]+/).filter(n => /^0\d{6,15}$/.test(n));
        if (numbers.length > 0) {
          return numbers;
        } else {
          // Invalid input, send error message and continue waiting
          await this.sendMessage(chatId, "❌ Nomor tidak valid. Gunakan format yang benar (contoh: 081234567890).");
          // Wait more for valid input
        }
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    return [];
  }

  stop() {
    this.running = false;
    console.log("Bot stopped.");
  }
}
