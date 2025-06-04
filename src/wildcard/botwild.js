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

    try {
      const testRes = await fetch(`https://${subdomain}`);
      if (testRes.status === 530) return 530;
    } catch {
      return 400;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = { environment: "production", hostname: domain, service: this.serviceName, zone_id: this.zoneID };
    const res = await fetch(url, { method: 'PUT', headers: this.headers, body: JSON.stringify(body) });
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

    const res = await fetch(`${listUrl}/${obj.id}`, { method: 'DELETE', headers: this.headers });
    return res.status;
  }

  // ========================
  // In-Memory CRUD for subdomain requests
  // ========================
  saveDomainRequest(request) {
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

    // Untuk menandai user yang sedang diminta kirim daftar delete
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

    const chatId  = update.message.chat.id;
    const from    = update.message.from;
    const username= from.username || from.first_name || 'Unknown';
    const text    = update.message.text || '';
    const isOwner = chatId === this.ownerId;
    const now     = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // ========== /add <subdomain> ==========
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
            `✅ Request domain berhasil!\n\n`+
            `🔗 ${full}\n👤 @${username}\n📅 ${now}\n⏳ Menunggu approval admin`
          );
          if (this.ownerId !== chatId) {
            await this.sendMessage(this.ownerId,
              `📬 Permintaan baru:\n`+
              `🔗 ${full}\n👤 @${username} (ID:${chatId})\n📅 ${now}`
            );
          }
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ========== /del [subdomain] ==========
    if (text.startsWith('/del')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const parts = text.split(' ').filter(Boolean);
      // jika hanya "/del"
      if (parts.length === 1) {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(chatId,
          '📝 Kirim daftar subdomain yang ingin dihapus (satu per baris):\n'+
          'Contoh:\nava.game.naver.com\nzoom.us'
        );
        return new Response('OK', { status: 200 });
      }
      // jika "/del <subdomain>"
      const sd = parts[1].trim();
      let st = 500;
      try { st = await this.globalBot.deleteSubdomain(sd); } catch {}
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const reply = st === 200      ? `✅ ${full} dihapus.` :
                    st === 404      ? `⚠️ ${full} tidak ditemukan.` :
                                      `❌ Gagal hapus ${full}, status:${st}.`;
      await this.sendMessage(chatId, reply);
      return new Response('OK', { status: 200 });
    }

    // ==== Proses daftar setelah /del ====
    if (this.awaitingDeleteList[chatId]) {
      delete this.awaitingDeleteList[chatId];
      const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
      if (!lines.length) {
        await this.sendMessage(chatId, '⚠️ Tidak ada subdomain terdeteksi.');
        return new Response('OK', { status: 200 });
      }
      let hasil = '';
      for (const d0 of lines) {
        const d = d0.toLowerCase();
        if (!d.endsWith(this.globalBot.rootDomain)) {
          hasil += `🔸 ${d} → ❌ Bukan anak domain ${this.globalBot.rootDomain}\n`;
          continue;
        }
        const sub = d.replace(`.${this.globalBot.rootDomain}`, '');
        let st = 500;
        try { st = await this.globalBot.deleteSubdomain(sub); } catch {}
        hasil += st===200
          ? `✅ ${d} dihapus.\n`
          : st===404
            ? `⚠️ ${d} tidak ditemukan.\n`
            : `❌ ${d} gagal (status:${st}).\n`;
      }
      await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // ========== /list ==========
    if (text.startsWith('/list')) {
      let list = [];
      try { list = await this.globalBot.getDomainList(); } catch {}
      if (!list.length) {
        await this.sendMessage(chatId, '📭 Belum ada subdomain terdaftar.');
      } else {
        const lines = list.map((d,i)=>`${i+1}. ${d}`).join('\n');
        await this.sendMessage(chatId, `📋 Daftar Subdomain:\n${lines}\n\nTotal: ${list.length}`);
        // kirim file teks
        const file = lines;
        await this.sendDocument(chatId, file, 'subdomain-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // ========== /approve <subdomain> ==========
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const sd2 = text.split(' ')[1]?.trim();
      const full2 = `${sd2}.${this.globalBot.rootDomain}`;
      const req = this.globalBot.findPendingRequest(sd2);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request untuk ${full2}.`);
      } else {
        let st2 = 500;
        try { st2 = await this.globalBot.addSubdomain(sd2); } catch {}
        if (st2 === 200) {
          this.globalBot.updateRequestStatus(sd2, 'approved');
          await this.sendMessage(chatId, `✅ ${full2} disetujui & ditambahkan.`);
          await this.sendMessage(req.requesterId, `✅ Permintaan ${full2} disetujui pada ${now}.`);
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan ${full2}, status:${st2}.`);
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ========== /reject <subdomain> ==========
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const sd3 = text.split(' ')[1]?.trim();
      const full3 = `${sd3}.${this.globalBot.rootDomain}`;
      const req3 = this.globalBot.findPendingRequest(sd3);
      if (!req3) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request untuk ${full3}.`);
      } else {
        this.globalBot.updateRequestStatus(sd3, 'rejected');
        await this.sendMessage(chatId, `❌ Permintaan ${full3} ditolak.`);
        await this.sendMessage(req3.requesterId, `❌ Permintaan ${full3} Anda ditolak pada ${now}.`);
      }
      return new Response('OK', { status: 200 });
    }

    // ========== /req ==========
    if (text.startsWith('/req')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const all = this.globalBot.getAllRequests();
      if (!all.length) {
        await this.sendMessage(chatId, '📭 Belum ada request subdomain.');
      } else {
        let out = all.map((r,i)=>{
          return `${i+1}. ${r.domain} — ${r.status}\n   by @${r.requesterUsername} (${r.requesterId}) at ${r.requestTime}`;
        }).join('\n\n');
        await this.sendMessage(chatId, `📋 Semua Request:\n\n${out}`);
      }
      return new Response('OK', { status: 200 });
    }

    // fallback
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
