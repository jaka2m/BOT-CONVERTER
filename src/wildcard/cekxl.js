export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  normalizeNumber(number) {
    let num = number.trim();
    if (num.startsWith('0')) {
      num = '62' + num.slice(1);
    }
    return num;
  }

  async handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!chatId || !text) return;

    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      const replies = await Promise.all(numbers.map(async (num) => {
        return await this.cekKuota(num);
      }));

      return this.sendMessage(chatId, replies.join('\n\n'), true);
    }
  }

  async cekKuota(number) {
    const url = 'https://dompul.free-accounts.workers.dev/cek_kuota';

    const headers = {
      'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
      'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55',
      'X-App-Version': '4.0.0',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const normalizedNumber = this.normalizeNumber(number);

    try {
      const body = new URLSearchParams({ msisdn: normalizedNumber });
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Response error:', response.status, text);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dataText = await response.text();
      console.log('Response text:', dataText);

      const data = JSON.parse(dataText);
      const dataSp = data?.data?.data_sp;

      if (!dataSp) {
        return `❌ Gagal mendapatkan data untuk *${normalizedNumber}*.`;
      }

      let infoPelanggan = `
📌 *Info Pelanggan:*
🔢 *Nomor:* ${normalizedNumber}
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

      return (infoPelanggan + infoPaket).trim();

    } catch (error) {
      console.error('Error cek kuota:', error);
      return `❌ Gagal cek kuota untuk *${normalizedNumber}*.`;
    }
  }

  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {})
    };

    try {
      await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  }
}
