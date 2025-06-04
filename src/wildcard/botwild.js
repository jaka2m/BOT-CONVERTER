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
    this.waitingForDeleteList = this.waitingForDeleteList || new Set();

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

  // Simpan request baru
  saveDomainRequest(request) {
    // request = { domain, subdomain, requesterId, requesterUsername, requestTime, status }
    globalThis.subdomainRequests.push(request);
  }

  // Cari request pending
  findPendingRequest(subdomain, requesterId = null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain &&
      r.status === 'pending' &&
      (requesterId === null || r.requesterId === requesterId)
    );
  }

  // Update status request
  updateRequestStatus(subdomain, status) {
    const r = globalThis.subdomainRequests.find(r => r.subdomain === subdomain && r.status === 'pending');
    if (r) r.status = status;
  }

  // Ambil semua request
  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }

  // Ambil domain yang sudah approved
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
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    return this.globalBot?.escapeMarkdownV2
      ? this.globalBot.escapeMarkdownV2(text)
      : text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const from = update.message.from;
    const username = from.username || from.first_name || 'Unknown';
    const text = update.message.text || '';
    const isOwner = chatId === this.ownerId;
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // /add <subdomain>
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
        await this.sendMessage(chatId,
          st === 200
            ? `✅ Domain *${full}* berhasil ditambahkan oleh owner.`
            : `❌ Gagal menambahkan domain *${full}*, status: ${st}`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }
      try {
        if (await this.globalBot.findPendingRequest(sd, chatId)) {
          await this.sendMessage(chatId,
            `⚠️ Anda sudah request domain *${full}* dan menunggu approval.`,
            { parse_mode: 'Markdown' }
          );
          return new Response('OK', { status: 200 });
        }
      } catch {}
      await this.sendMessage(chatId,
`✅ Request domain berhasil dikirim!

🔗 Domain: ${full}
👤 Requester: @${username}
📅 Time: ${now}

⏳ Status: Menunggu approval admin`
      );
      this.globalBot.saveDomainRequest({ domain: full, subdomain: sd, requesterId: chatId, requesterUsername: username, requestTime: now, status: 'pending' });
      if (this.ownerId !== chatId) {
        await this.sendMessage(this.ownerId,
`📬 Permintaan subdomain baru!

🔗 Domain: ${full}
👤 Pengguna: @${username} (ID: ${chatId})
📅 Waktu: ${now}`
        );
      }
      return new Response('OK', { status: 200 });
    }

if (text === '/del') {
  if (!isOwner) {
    await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
    return new Response('OK', { status: 200 });
  }
  await this.sendMessage(chatId, 'Silakan kirim daftar subdomain yang ingin dihapus, satu per baris.');
  this.waitingForDeleteList.add(chatId);
  return new Response('OK', { status: 200 });
}

if (this.waitingForDeleteList.has(chatId)) {
  // Pesan berikutnya setelah /del dianggap daftar subdomain hapus
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    await this.sendMessage(chatId, '❌ Tidak ada subdomain yang diterima, batal hapus.');
    this.waitingForDeleteList.delete(chatId);
    return new Response('OK', { status: 200 });
  }

  let results = [];
  for (const sd of lines) {
    let st = 500;
    try {
      st = await this.globalBot.deleteSubdomain(sd);
    } catch {}
    results.push({ domain: sd, status: st });
  }
  this.waitingForDeleteList.delete(chatId);

  let msg = 'Hasil penghapusan subdomain:\n\n';
  for (const r of results) {
    const dm = this.escapeMarkdownV2(r.domain);
    if (r.status === 200) {
      msg += `✅ \`\`\`Wildcard\n${dm} deleted successfully.\`\`\`\n\n`;
    } else if (r.status === 404) {
      msg += `⚠️ Subdomain *${dm}* not found.\n\n`;
    } else {
      msg += `❌ Gagal hapus *${dm}*, status: \`${r.status}\`\n\n`;
    }
  }

  await this.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
  return new Response('OK', { status: 200 });
}

    // /list
    if (text.startsWith('/list')) {
      let domains = [];
      try { domains = await this.globalBot.getDomainList(); } catch {}
      if (!domains.length) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const list = domains.map((d,i) => `${i+1}\\. ${this.escapeMarkdownV2(d)}`).join('\n');
        await this.sendMessage(chatId,
          `\`\`\`List-Wildcard
${list}\`\`\`\n\nTotal: *${domains.length}* subdomain${domains.length>1?'s':''}`,
          { parse_mode: 'MarkdownV2' }
        );
        const file = domains.map((d,i)=>`${i+1}. ${d}`).join('\n');
        await this.sendDocument(chatId, file, 'wildcard-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // /approve <subdomain>
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
        await this.sendMessage(chatId,
          `⚠️ Tidak ada request pending untuk subdomain *${full}*.`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }
      let st; try { st = await this.globalBot.addSubdomain(sd); } catch {}
      if (st === 200) {
        this.globalBot.updateRequestStatus(sd, 'approved');
        await this.sendMessage(chatId, `✅ Domain *${full}* disetujui dan ditambahkan.`, { parse_mode: 'Markdown' });
        await this.sendMessage(req.requesterId, `✅ Permintaan domain *${full}* Anda telah disetujui pada:\n${now}`, { parse_mode: 'Markdown' });
      } else {
        await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${full}*, status: ${st}`, { parse_mode: 'Markdown' });
      }
      return new Response('OK', { status: 200 });
    }

    // /reject <subdomain>
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
        await this.sendMessage(chatId,
          `⚠️ Tidak ada request pending untuk subdomain *${full}*.`,
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }
      this.globalBot.updateRequestStatus(sd, 'rejected');
      await this.sendMessage(chatId, `❌ Permintaan domain *${full}* telah ditolak.`, { parse_mode: 'Markdown' });
      await this.sendMessage(req.requesterId, `❌ Permintaan domain *${full}* Anda telah ditolak pada:\n${now}`, { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/req')) {
  if (!isOwner) {
    await this.sendMessage(chatId, '⛔ Anda tidak berwenang melihat daftar request.', { parse_mode: 'MarkdownV2' });
    return new Response('OK', { status: 200 });
  }
  const all = this.globalBot.getAllRequests();
  if (!all.length) {
    await this.sendMessage(chatId, '📭 Belum ada request subdomain masuk.', { parse_mode: 'MarkdownV2' });
  } else {
    let lines = '';
    all.forEach((r, i) => {
      const domain = this.escapeMarkdownV2(r.domain);
      const status = this.escapeMarkdownV2(r.status);
      const requester = this.escapeMarkdownV2(r.requesterUsername);
      const requesterId = this.escapeMarkdownV2(r.requesterId.toString());
      const time = this.escapeMarkdownV2(r.requestTime);

      lines += `*${i + 1}\\. ${domain}* — _${status}_\n`;
      lines += `   requester: @${requester} \\(ID: ${requesterId}\\)\n`;
      lines += `   waktu: ${time}\n\n`;
    });
    const message = `📋 *Daftar Semua Request:*\n\n${lines}`;
    await this.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  }
  return new Response('OK', { status: 200 });
}


    // fallback
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, { method: 'POST', body: formData });
  }
}
