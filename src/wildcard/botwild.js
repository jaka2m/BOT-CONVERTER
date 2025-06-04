// ========================================
// Main Telegram Wildcard Bot Entry Point
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Global Constants & In-Memory Request Storage
// ========================================
export class KonstantaGlobalbot {
  constructor({ apiKey, rootDomain, accountID, zoneID, apiEmail, serviceName }) {
    this.apiKey = apiKey;
    this.rootDomain = rootDomain;
    this.accountID = accountID;
    this.zoneID = zoneID;
    this.apiEmail = apiEmail;
    this.serviceName = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email': this.apiEmail,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    // In-memory storage untuk request subdomain
    if (!globalThis.subdomainRequests) globalThis.subdomainRequests = [];
  }

  // Escape teks agar aman untuk MarkdownV2
  escapeMarkdownV2(text) {
    return text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  // Cloudflare API: ambil daftar domain Workers
  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json.result
      .filter(d => d.service === this.serviceName)
      .map(d => d.hostname);
  }

  // Cloudflare API: tambahkan subdomain
  async addSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();
    if (!domain.endsWith(this.rootDomain)) return 400;

    const registered = await this.getDomainList();
    if (registered.includes(domain)) return 409;

    // Coba fetch untuk cek status
    try {
      const testRes = await fetch(`https://${subdomain}`);
      if (testRes.status === 530) return 530;
    } catch {
      return 400;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname: domain,
      service: this.serviceName,
      zone_id: this.zoneID
    };
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body)
    });
    return res.status;
  }

  // Cloudflare API: hapus subdomain
  async deleteSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok) return listRes.status;

    const json = await listRes.json();
    const obj = json.result.find(d => d.hostname === domain);
    if (!obj) return 404;

    const res = await fetch(`${listUrl}/${obj.id}`, {
      method: 'DELETE',
      headers: this.headers
    });
    return res.status;
  }

  // ========================
  // In-Memory CRUD for subdomain requests
  // ========================
  saveDomainRequest(request) {
    // request = { domain, subdomain, requesterId, requesterUsername, requestTime, status }
    globalThis.subdomainRequests.push(request);
  }

  findPendingRequest(subdomain, requesterId = null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain &&
      r.status === 'pending' &&
      (requesterId === null || r.requesterId === requesterId)
    );
  }

  updateRequestStatus(subdomain, status) {
    const r = globalThis.subdomainRequests.find(r => r.subdomain === subdomain && r.status === 'pending');
    if (r) r.status = status;
  }

  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }

  getApprovedDomainList() {
    return globalThis.subdomainRequests
      .filter(r => r.status === 'approved')
      .map(r => r.domain);
  }
}

// ========================================
// Telegram Bot Handler: TelegramWildcardBot
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.globalBot = globalBot;

    // Tandai user yang sedang diminta kirim daftar delete
    this.awaitingDeleteList = {};

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    return this.globalBot?.escapeMarkdownV2
      ? this.globalBot.escapeMarkdownV2(text)
      : text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId   = update.message.chat.id;
    const from     = update.message.from;
    const username = from.username || from.first_name || 'Unknown';
    const text     = update.message.text || '';
    const isOwner  = chatId === this.ownerId;
    const now      = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // ======================
    // /add <subdomain>
    // ======================
    if (text.startsWith('/add ')) {
      const sd = text.split(' ')[1]?.trim();
      if (!sd) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /add.');
        return new Response('OK', { status: 200 });
      }
      const full = `${sd}.${this.globalBot.rootDomain}`;
      if (isOwner) {
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        const msg = st === 200
          ? `✅ Domain ${full} berhasil ditambahkan oleh owner.`
          : `❌ Gagal menambahkan ${full}, status: ${st}.`;
        await this.sendMessage(chatId, msg);
      } else {
        if (await this.globalBot.findPendingRequest(sd, chatId)) {
          await this.sendMessage(chatId, `⚠️ Anda sudah request ${full} dan menunggu approval.`);
        } else {
          this.globalBot.saveDomainRequest({
            domain: full,
            subdomain: sd,
            requesterId: chatId,
            requesterUsername: username,
            requestTime: now,
            status: 'pending'
          });
          await this.sendMessage(chatId,
            `✅ Request domain berhasil!\n\n` +
            `🔗 ${full}\n` +
            `👤 @${username}\n` +
            `📅 ${now}\n` +
            `⏳ Menunggu approval admin`
          );
          if (this.ownerId !== chatId) {
            await this.sendMessage(this.ownerId,
              `📬 Permintaan baru:\n` +
              `🔗 ${full}\n` +
              `👤 @${username} (ID: ${chatId})\n` +
              `📅 ${now}`
            );
          }
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ======================
    // /del [subdomain...] 
    // ======================
    if (text.startsWith('/del')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      // Ambil isi setelah "/del"
      // (panjang 4 karakter: '/', 'd', 'e', 'l')
      const after = text.slice(4).trim();

      // 1) Jika tidak ada konten setelah "/del" (user hanya ketik "/del")
      if (!after) {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(chatId,
          '📝 Silakan kirim daftar subdomain yang ingin dihapus (satu per baris). Contoh:\n' +
          'ava.game.naver.com\n' +
          'zaintest.vuclip.com\n' +
          'support.zoom.us\n' +
          'cache.netflix.com\n' +
          'business.blibli.com\n' +
          'quiz.int.vidio.com\n' +
          'live.iflix.com\n' +
          'blog.webex.com'
        );
        return new Response('OK', { status: 200 });
      }

      // 2) Jika ada konten setelah "/del": bisa jadi subdomain tunggal
      //    atau banyak subdomain (pemisah newline atau spasi)
      //    Kita anggap newline sebagai pemisah utama
      const lines = after.split('\n')
                         .map(l => l.trim())
                         .filter(Boolean);

      // Jika hanya satu baris dan tidak ada newline:
      // misal: "/del xyz"
      // after = "xyz"
      // lines = ["xyz"]
      // Kita tetap proses sebagai satu domain

      let hasil = '';
      for (const domainRaw of lines) {
        const d = domainRaw.toLowerCase();
        // Jika domainRaw sudah mencakup rootDomain, kita ambil bagian sebelum rootDomain
        let subToDelete;
        if (d.endsWith(this.globalBot.rootDomain)) {
          // misal d="ava.game.naver.com", rootDomain="game.naver.com"
          // subToDelete = "ava"
          const idx = d.lastIndexOf(`.${this.globalBot.rootDomain}`);
          subToDelete = idx > 0 ? d.slice(0, idx) : '';
        } else {
          // Kalau tidak ada, mungkin user kirim langsung subdomain saja
          subToDelete = d;
        }

        // Pastikan subToDelete bukan kosong
        if (!subToDelete) {
          hasil += `🔸 ${d} → ❌ Format tidak valid atau tidak mengandung root domain ${this.globalBot.rootDomain}\n`;
          continue;
        }

        // Hapus subdomain via globalBot
        let st = 500;
        try { st = await this.globalBot.deleteSubdomain(subToDelete); } catch {}
        const fullDomain = `${subToDelete}.${this.globalBot.rootDomain}`;
        if (st === 200) {
          hasil += `✅ ${fullDomain} dihapus.\n`;
        } else if (st === 404) {
          hasil += `⚠️ ${fullDomain} tidak ditemukan.\n`;
        } else {
          hasil += `❌ ${fullDomain} gagal (status: ${st}).\n`;
        }
      }

      // Kirim hasil sebagai plain text
      await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // ================================
    // Proses input daftar setelah "/del"
    // (jika user mengirim daftar di pesan terpisah)
    // ================================
    if (this.awaitingDeleteList[chatId]) {
      delete this.awaitingDeleteList[chatId];

      const lines = text.split('\n')
                        .map(l => l.trim())
                        .filter(Boolean);
      if (!lines.length) {
        await this.sendMessage(chatId, '⚠️ Tidak ada subdomain terdeteksi dalam input Anda.');
        return new Response('OK', { status: 200 });
      }

      let hasil = '';
      for (const domainRaw of lines) {
        const d = domainRaw.toLowerCase();
        let subToDelete;
        if (d.endsWith(this.globalBot.rootDomain)) {
          const idx = d.lastIndexOf(`.${this.globalBot.rootDomain}`);
          subToDelete = idx > 0 ? d.slice(0, idx) : '';
        } else {
          subToDelete = d;
        }
        if (!subToDelete) {
          hasil += `🔸 ${d} → ❌ Format tidak valid atau tidak mengandung root domain ${this.globalBot.rootDomain}\n`;
          continue;
        }
        let st = 500;
        try { st = await this.globalBot.deleteSubdomain(subToDelete); } catch {}
        const fullDomain = `${subToDelete}.${this.globalBot.rootDomain}`;
        if (st === 200) {
          hasil += `✅ ${fullDomain} dihapus.\n`;
        } else if (st === 404) {
          hasil += `⚠️ ${fullDomain} tidak ditemukan.\n`;
        } else {
          hasil += `❌ ${fullDomain} gagal (status: ${st}).\n`;
        }
      }

      await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // ======================
    // /list
    // ======================
    if (text.startsWith('/list')) {
      let domains = [];
      try { domains = await this.globalBot.getDomainList(); } catch {}
      if (!domains.length) {
        await this.sendMessage(chatId, '📭 Belum ada subdomain terdaftar.');
      } else {
        const lines = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendMessage(chatId, `📋 Daftar Subdomain:\n\n${lines}\n\nTotal: ${domains.length}`);
        // Kirim juga sebagai file teks
        await this.sendDocument(chatId, lines, 'subdomain-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // ======================
    // /approve <subdomain>
    // ======================
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk ${full}.`);
      } else {
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        if (st === 200) {
          this.globalBot.updateRequestStatus(sd, 'approved');
          await this.sendMessage(chatId, `✅ ${full} disetujui & ditambahkan.`);
          await this.sendMessage(req.requesterId, `✅ Permintaan ${full} Anda disetujui pada:\n${now}`);
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan ${full}, status: ${st}.`);
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ======================
    // /reject <subdomain>
    // ======================
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk ${full}.`);
      } else {
        this.globalBot.updateRequestStatus(sd, 'rejected');
        await this.sendMessage(chatId, `❌ Permintaan ${full} telah ditolak.`);
        await this.sendMessage(req.requesterId, `❌ Permintaan ${full} Anda ditolak pada:\n${now}`);
      }
      return new Response('OK', { status: 200 });
    }

    // ======================
    // /req
    // ======================
    if (text.startsWith('/req')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang melihat daftar request.');
        return new Response('OK', { status: 200 });
      }
      const all = this.globalBot.getAllRequests();
      if (!all.length) {
        await this.sendMessage(chatId, '📭 Belum ada request subdomain.');
      } else {
        const out = all.map((r, i) => {
          return `${i + 1}. ${r.domain} — ${r.status}\n   by @${r.requesterUsername} (ID: ${r.requesterId}) at ${r.requestTime}`;
        }).join('\n\n');
        await this.sendMessage(chatId, `📋 Semua Request:\n\n${out}`);
      }
      return new Response('OK', { status: 200 });
    }

    // Fallback: tidak ada perintah cocok
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
  }
}
