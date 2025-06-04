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
    this.apiKey      = apiKey;
    this.rootDomain  = rootDomain;
    this.accountID   = accountID;
    this.zoneID      = zoneID;
    this.apiEmail    = apiEmail;
    this.serviceName = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email':   this.apiEmail,
      'X-Auth-Key':     this.apiKey,
      'Content-Type':   'application/json',
    };

    if (!globalThis.subdomainRequests) globalThis.subdomainRequests = [];
  }

  escapeMarkdownV2(text) {
    return text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json.result
      .filter(d => d.service === this.serviceName)
      .map(d => d.hostname);
  }

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
    const url  = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname:    domain,
      service:     this.serviceName,
      zone_id:     this.zoneID
    };
    const res = await fetch(url, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify(body)
    });
    return res.status;
  }

  async deleteSubdomain(subdomain) {
    const domain  = `${subdomain}.${this.rootDomain}`.toLowerCase();
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok) return listRes.status;
    const json = await listRes.json();
    const obj  = json.result.find(d => d.hostname === domain);
    if (!obj) return 404;
    const res = await fetch(`${listUrl}/${obj.id}`, {
      method:  'DELETE',
      headers: this.headers
    });
    return res.status;
  }

  saveDomainRequest(request) {
    globalThis.subdomainRequests.push(request);
  }

  findPendingRequest(subdomain, requesterId = null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain &&
      r.status    === 'pending' &&
      (requesterId === null || r.requesterId === requesterId)
    );
  }

  updateRequestStatus(subdomain, status) {
    const r = globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain && r.status === 'pending'
    );
    if (r) r.status = status;
  }

  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }
}

// ========================================
// Telegram Bot Handler: TelegramWildcardBot
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token      = token;
    this.apiUrl     = apiUrl || 'https://api.telegram.org';
    this.ownerId    = ownerId;
    this.globalBot  = globalBot;

    // flags for list input
    this.awaitingAddList    = {};
    this.awaitingDeleteList = {};

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    return this.globalBot.escapeMarkdownV2(text);
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const from   = update.message.from;
    const user   = from.username || from.first_name || 'Unknown';
    const text   = update.message.text || '';
    const isOwner= chatId === this.ownerId;
    const now    = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // 1) /add (single or multi)
    if (text.startsWith('/add')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const after = text.slice(4).trim();
      if (!after) {
        this.awaitingAddList[chatId] = true;
        await this.sendMessage(chatId,
          '📝 Kirim list subdomain untuk DITAMBAHKAN (satu per baris). Contoh:\n' +
          'ava\nzaintest\nsupport\n'
        );
        return new Response('OK', { status: 200 });
      }
      // process immediately
      const lines = after.split('\n').map(l => l.trim()).filter(Boolean);
      let hasil = '';
      for (let raw of lines) {
        let sd = raw.toLowerCase();
        if (sd.endsWith(`.${this.globalBot.rootDomain}`)) {
          sd = sd.slice(0, sd.lastIndexOf(`.${this.globalBot.rootDomain}`));
        }
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        const full = `${sd}.${this.globalBot.rootDomain}`;
        if      (st === 200) hasil += `✅ ${full} ditambahkan.\n`;
        else if (st === 409) hasil += `⚠️ ${full} sudah ada.\n`;
        else                 hasil += `❌ ${full} gagal (status:${st}).\n`;
      }
      await this.sendMessage(chatId, `Hasil penambahan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // process list after /add
    if (this.awaitingAddList[chatId]) {
      delete this.awaitingAddList[chatId];
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let hasil = '';
      for (let raw of lines) {
        let sd = raw.toLowerCase();
        if (sd.endsWith(`.${this.globalBot.rootDomain}`)) {
          sd = sd.slice(0, sd.lastIndexOf(`.${this.globalBot.rootDomain}`));
        }
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        const full = `${sd}.${this.globalBot.rootDomain}`;
        if      (st === 200) hasil += `✅ ${full} ditambahkan.\n`;
        else if (st === 409) hasil += `⚠️ ${full} sudah ada.\n`;
        else                 hasil += `❌ ${full} gagal (status:${st}).\n`;
      }
      await this.sendMessage(chatId, `Hasil penambahan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // 2) /del (single or multi)
    if (text.startsWith('/del')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const after = text.slice(4).trim();
      if (!after) {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(chatId,
          '📝 Kirim list subdomain untuk DIHAPUS (satu per baris). Contoh:\n' +
          'ava.game.naver.com\nzaintest.vuclip.com\nsupport.zoom.us\n'
        );
        return new Response('OK', { status: 200 });
      }
      const lines = after.split('\n').map(l => l.trim()).filter(Boolean);
      let hasil = '';
      for (let raw of lines) {
        let d = raw.toLowerCase();
        let sd;
        if (d.endsWith(`.${this.globalBot.rootDomain}`)) {
          sd = d.slice(0, d.lastIndexOf(`.${this.globalBot.rootDomain}`));
        } else {
          sd = d;
        }
        let st = 500;
        try { st = await this.globalBot.deleteSubdomain(sd); } catch {}
        const full = `${sd}.${this.globalBot.rootDomain}`;
        if      (st === 200) hasil += `✅ ${full} dihapus.\n`;
        else if (st === 404) hasil += `⚠️ ${full} tidak ditemukan.\n`;
        else                 hasil += `❌ ${full} gagal (status:${st}).\n`;
      }
      await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // process list after /del
    if (this.awaitingDeleteList[chatId]) {
      delete this.awaitingDeleteList[chatId];
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let hasil = '';
      for (let raw of lines) {
        let d = raw.toLowerCase();
        let sd;
        if (d.endsWith(`.${this.globalBot.rootDomain}`)) {
          sd = d.slice(0, d.lastIndexOf(`.${this.globalBot.rootDomain}`));
        } else {
          sd = d;
        }
        let st = 500;
        try { st = await this.globalBot.deleteSubdomain(sd); } catch {}
        const full = `${sd}.${this.globalBot.rootDomain}`;
        if      (st === 200) hasil += `✅ ${full} dihapus.\n`;
        else if (st === 404) hasil += `⚠️ ${full} tidak ditemukan.\n`;
        else                 hasil += `❌ ${full} gagal (status:${st}).\n`;
      }
      await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
      return new Response('OK', { status: 200 });
    }

    // 3) /list
    if (text.startsWith('/list')) {
      let domains = [];
      try { domains = await this.globalBot.getDomainList(); } catch {}
      if (!domains.length) {
        await this.sendMessage(chatId, '📭 Belum ada subdomain terdaftar.');
      } else {
        const out = domains.map((d,i) => `${i+1}. ${d}`).join('\n');
        await this.sendMessage(chatId, `📋 Daftar Subdomain:\n\n${out}\n\nTotal: ${domains.length}`);
        await this.sendDocument(chatId, out, 'subdomain-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // 4) /approve <subdomain>
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req  = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk ${full}.`);
      } else {
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        if (st === 200) {
          this.globalBot.updateRequestStatus(sd, 'approved');
          await this.sendMessage(chatId, `✅ ${full} disetujui & ditambahkan.`);
          await this.sendMessage(req.requesterId, `✅ Permintaan ${full} disetujui pada ${now}.`);
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan ${full}, status:${st}.`);
        }
      }
      return new Response('OK', { status: 200 });
    }

    // 5) /reject <subdomain>
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req  = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk ${full}.`);
      } else {
        this.globalBot.updateRequestStatus(sd, 'rejected');
        await this.sendMessage(chatId, `❌ Permintaan ${full} ditolak.`);
        await this.sendMessage(req.requesterId, `❌ Permintaan ${full} Anda ditolak pada ${now}.`);
      }
      return new Response('OK', { status: 200 });
    }

    // 6) /req (list all requests)
    if (text.startsWith('/req')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang.');
        return new Response('OK', { status: 200 });
      }
      const all = this.globalBot.getAllRequests();
      if (!all.length) {
        await this.sendMessage(chatId, '📭 Belum ada request subdomain.');
      } else {
        const out = all.map((r,i) =>
          `${i+1}. ${r.domain} — ${r.status}\n   by @${r.requesterUsername} (${r.requesterId}) at ${r.requestTime}`
        ).join('\n\n');
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body:   formData
    });
  }
}
