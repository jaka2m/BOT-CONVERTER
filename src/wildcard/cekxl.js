// File: telegramCekkuota.js

export async function Cekkuota(link) {
  console.log("Bot link:", link);
}

export class TelegramCekkuota {
  /**
   * @param {string} token — token bot Telegram (misal "12345:ABC-DEF...")
   * @param {string} apiUrlBase — base URL Telegram API (default: "https://api.telegram.org")
   */
  constructor(token, apiUrlBase = "https://api.telegram.org") {
    this.token = token;
    this.apiUrlBase = apiUrlBase;
  }

  /**
   * Fungsi utama yang akan dipanggil oleh webhook Telegram.
   * @param {object} update — objek update yang dikirimkan Telegram
   */
  async handleUpdate(update) {
    // Jika bukan pesan update, cukup kirim response 200
    if (!update.message) {
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = (message.text || "").trim();

    // 1) Jika pesan dimulai dengan "/cek"
    if (text.startsWith("/cek")) {
      // Bisa diganti sesuai alur yang diinginkan
      await this.sendMessage(chatId, "baik dulu sebelum nanya.", true);
      return new Response("OK", { status: 200 });
    }

    // 2) Jika pesan berisi "://", anggap sebagai "link"
    if (text.includes("://")) {
      // Contoh sederhana: ambil setiap baris yang mengandung "://"
      const links = text
        .split("\n")
        .map((ln) => ln.trim())
        .filter((ln) => ln.includes("://"));

      if (links.length === 0) {
        await this.sendMessage(
          chatId,
          "No valid links found. Please kirim VMess, VLESS, Trojan, atau Shadowsocks links.",
          true
        );
      } else {
        // Di sini Anda bisa memproses link tersebut (misal: parse, convert, atau kirim file).
        // Sebagai contoh, kita hanya kirim balik daftar link yang diterima:
        const balik = ["Link yang ditemukan:"];
        links.forEach((ln, idx) => {
          balik.push(`${idx + 1}. ${ln}`);
        });
        await this.sendMessage(chatId, balik.join("\n"), false);
      }

      return new Response("OK", { status: 200 });
    }

    // 3) Selain /cek dan link, coba cari nomor HP (10–13 digit)
    const numbers = text.match(/\d{10,13}/g);
    if (numbers && numbers.length > 0) {
      // Proses setiap nomor secara paralel: cek kuota via API baru
      const hasilPromises = numbers.map((msisdn) => this.checkOneNumber(msisdn));
      const hasilArray = await Promise.all(hasilPromises);
      // Gabungkan jawaban setiap nomor, pisah dengan satu baris kosong
      const finalText = hasilArray.join("\n\n");
      await this.sendMessage(chatId, finalText, true);
      return new Response("OK", { status: 200 });
    }

    // 4) Jika tidak ada perintah khusus, kirim pesan default
    await this.sendMessage(
      chatId,
      "Silakan ketik /cek, atau kirim link/proxy, atau ketik nomor HP untuk cek kuota.",
      true
    );
    return new Response("OK", { status: 200 });
  }

  /**
   * Melakukan request ke endpoint cek kuota dengan header otorisasi yang telah disediakan.
   * Jika berhasil, kembalikan string berisi informasi kartu dan paket; jika gagal, kembalikan pesan "❌ Gagal cek kuota…".
   *
   * @param {string} msisdn — nomor HP (misal "087756116610")
   * @returns {Promise<string>}
   */
  async checkOneNumber(msisdn) {
    // 1) Bentuk URL endpoint sesuai permintaan:
    const apiUrl = `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota?msisdn=${msisdn}&isJSON=true`;

    // 2) Siapkan header sesuai contoh:
    const headers = {
      Authorization: "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
      "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
      "X-App-Version": "4.0.0",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    };

    try {
      const apiResponse = await fetch(apiUrl, { headers });
      if (!apiResponse.ok) {
        // Jika status ≠ 200, ambil debug JSON (jika ada) atau kosong
        let debugData = {};
        try {
          debugData = await apiResponse.json();
        } catch {
          debugData = { message: "Tidak dapat mengurai respons error" };
        }
        console.error(
          `HTTP ${apiResponse.status} saat cek kuota untuk ${msisdn}:`,
          debugData
        );
        return `❌ Gagal cek kuota untuk ${msisdn}`;
      }

      // Jika ok, parsing JSON
      const data = await apiResponse.json();
      console.log(`🔍 Respons API untuk ${msisdn}:`, JSON.stringify(data));

      // Menurut contoh struktur:
      // {
      //   "status": true,
      //   "message": "SUCCESS",
      //   "statusCode": 200,
      //   "data": {
      //     "data_sp": { … },
      //     "hasil": "…",
      //     "msisdn": "087756116610"
      //   }
      // }
      const info = data?.data?.data_sp ?? null;
      const rawHasil = data?.data?.hasil ?? "";

      if (!info) {
        // Jika data_sp tidak ada, tampilkan fallback dari `hasil`
        const teksSaja = rawHasil
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();

        return `📱 Nomor: ${msisdn}

❗ Info:
${teksSaja || "Tidak ada detail paket kuota."}`;
      }

      // Jika info ada, format jawaban lengkap
      return this.formatQuotaResponse(msisdn, info, rawHasil);
    } catch (err) {
      console.error(`ERROR fetch untuk ${msisdn}:`, err);
      return `❌ Gagal cek kuota untuk ${msisdn}`;
    }
  }

  /**
   * Merakit teks output ketika data_sp ditemukan.
   * @param {string} number — nomor HP
   * @param {object} info — objek data_sp
   * @param {string} rawHasil — fallback HTML jika kuota kosong
   * @returns {string}
   */
  formatQuotaResponse(number, info, rawHasil) {
    // Ambil field‐field yang diperlukan:
    const {
      prefix, // { value: "XL" }
      active_card, // { value: "5 Tahun 11 Bulan" }
      dukcapil, // { value: "Sudah" }
      status_4g, // { value: "4G" }
      active_period, // { value: "2025-06-25" }
      grace_period, // { value: "2025-07-25" }
      quotas, // { value: [ [ { packages: {...}, benefits: [] } ], … ] }
    } = info;

    // 1) Header informasi umum
    let msg = `📱 Nomor: ${number}\n`;
    msg += `• Tipe Kartu: ${prefix?.value || "-"}\n`;
    msg += `• Umur Kartu: ${active_card?.value || "-"}\n`;
    msg += `• Status Dukcapil: ${dukcapil?.value || "-"}\n`;
    msg += `• Status 4G: ${status_4g?.value || "-"}\n`;
    msg += `• Masa Aktif: ${active_period?.value || "-"}\n`;
    msg += `• Masa Tenggang: ${grace_period?.value || "-"}\n\n`;

    // 2) Detail paket kuota (jika ada):
    const arrQuota = quotas?.value;
    if (Array.isArray(arrQuota) && arrQuota.length > 0) {
      msg += `📦 Detail Paket Kuota:\n`;
      arrQuota.forEach((group) => {
        if (!Array.isArray(group) || group.length === 0) return;
        const pkg = group[0].packages;
        msg += `\n🎁 Paket: ${pkg?.name || "-"}\n`;
        msg += `📅 Aktif Hingga: ${this.formatDate(pkg?.expDate)}\n`;
        msg += `-----------------------------\n`;
      });
      return msg.trim();
    }

    // 3) Jika quotas kosong, tampilkan fallback `rawHasil`
    const teksSaja = rawHasil
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    msg += `❗ Info Tambahan:\n${teksSaja || "Tidak ada detail paket kuota."}`;
    return msg.trim();
  }

  /**
   * Mengubah ISO‐string (misal "2025-06-11T23:59:59") menjadi "YYYY-MM-DD hh:mm:ss".
   * @param {string} dateStr
   * @returns {string}
   */
  formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const pad = (n) => (n < 10 ? "0" + n : n);
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  }

  /**
   * Mengirim pesan teks ke Telegram.
   * @param {number|string} chatId
   * @param {string} text — konten pesan (bisa menggunakan Markdown jika markdown=true)
   * @param {boolean} [markdown=false] — jika true, akan ditambahkan parse_mode: "Markdown"
   * @returns {Promise<object>}
   */
  async sendMessage(chatId, text, markdown = false) {
    const payload = {
      chat_id: chatId,
      text,
      ...(markdown ? { parse_mode: "Markdown" } : {}),
    };

    const url = `${this.apiUrlBase}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  /**
   * Mengirim file (PDF, TXT, CSV, dsb.) ke Telegram sebagai document.
   * @param {number|string} chatId
   * @param {Uint8Array|string} content — isi file (bisa Uint8Array, string, dll.)
   * @param {string} filename — nama file, misal "hasil.txt" atau "config.pdf"
   * @param {string} mimeType — misal "text/plain" atau "application/pdf"
   * @returns {Promise<object>}
   */
  async sendDocument(chatId, content, filename, mimeType) {
    // Gunakan FormData untuk upload file
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append("document", blob, filename);
    formData.append("chat_id", chatId.toString());

    const url = `${this.apiUrlBase}/bot${this.token}/sendDocument`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });
    return response.json();
  }
}
