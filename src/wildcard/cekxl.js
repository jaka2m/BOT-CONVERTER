export class TelegramCekkuota {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/cek')) {
      // Contoh: /cek 6287765101308
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this.sendMessage(chatId, 'Format perintah salah. Contoh: /cek 6287765101308');
        return;
      }
      const msisdn = parts[1];

      await this.sendMessage(chatId, 'Sedang memproses cek kuota...');

      try {
        const result = await this.cekKuota(msisdn);
        if (result && result.status) {
          const pesan = this.formatCekKuota(result.data);
          await this.sendMessage(chatId, pesan);
        } else {
          await this.sendMessage(chatId, 'Gagal mendapatkan data kuota.');
        }
      } catch (e) {
        await this.sendMessage(chatId, 'Terjadi kesalahan: ' + e.message);
      }
    } else {
      await this.sendMessage(chatId, 'Kirim perintah /cek <nomor_hp> untuk cek kuota.');
    }
  }

  async cekKuota(msisdn) {
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;

    const headers = {
      Authorization: "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
      "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
      "X-App-Version": "4.0.0",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    };

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    return json;
  }

  formatCekKuota(data) {
    if (!data || !data.data_sp) return 'Data tidak lengkap.';

    const sp = data.data_sp;

    const msisdn = data.msisdn || 'N/A';
    const tipeKartu = sp.prefix.value || 'N/A';
    const status4G = sp.status_4g.value || 'N/A';
    const statusDukcapil = sp.dukcapil.value || 'N/A';
    const umurKartu = sp.active_card.value || 'N/A';
    const masaAktif = sp.active_period.value || 'N/A';
    const masaTenggang = sp.grace_period.value || 'N/A';

    let pesan = `📋 *Hasil Cek Kuota*\n\n`;
    pesan += `📱 Nomor: ${msisdn}\n`;
    pesan += `💳 Tipe Kartu: ${tipeKartu}\n`;
    pesan += `📶 Status 4G: ${status4G}\n`;
    pesan += `🆔 Status Dukcapil: ${statusDukcapil}\n`;
    pesan += `⏳ Umur Kartu: ${umurKartu}\n`;
    pesan += `📅 Masa Aktif: ${masaAktif}\n`;
    pesan += `⏰ Masa Tenggang: ${masaTenggang}\n\n`;

    // Kuota (array dua dimensi)
    const quotas = sp.quotas.value || [];
    for (const quotaGroup of quotas) {
      for (const q of quotaGroup) {
        const paket = q.packages || {};
        pesan += `🎁 Paket: ${paket.name || 'N/A'}\n`;
        pesan += `🗓 Aktif Hingga: ${paket.expDate ? paket.expDate.replace('T', ' ').replace('Z','') : 'N/A'}\n`;

        const benefits = q.benefits || [];
        if (benefits.length === 0) {
          pesan += `  (Tidak ada benefit kuota)\n`;
        } else {
          for (const b of benefits) {
            pesan += `  - Benefit: ${b.bname || '-'}\n`;
            pesan += `    Tipe Kuota: ${b.type || '-'}\n`;
            pesan += `    Kuota: ${b.quota || '-'}\n`;
            pesan += `    Sisa Kuota: ${b.remaining || '-'}\n`;
          }
        }
        pesan += `\n`;
      }
    }

    return pesan;
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    return response.json();
  }
}
