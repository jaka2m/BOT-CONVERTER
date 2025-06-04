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
      'X-Auth-Email':  this.apiEmail,
      'X-Auth-Key':    this.apiKey,
      'Content-Type':  'application/json',
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
    const { result } = await res.json();
    return result
      .filter(d => d.service === this.serviceName)
      .map(d => d.hostname);
  }

  async addSubdomain(sub) {
    const domain = `${sub}.${this.rootDomain}`.toLowerCase();
    if (!domain.endsWith(this.rootDomain)) return 400;

    const exists = await this.getDomainList();
    if (exists.includes(domain)) return 409;

    // quick test
    try {
      const test = await fetch(`https://${sub}`);
      if (test.status === 530) return 530;
    } catch {
      return 400;
    }

    const url  = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = { environment:"production", hostname:domain, service:this.serviceName, zone_id:this.zoneID };
    const res  = await fetch(url, { method:'PUT', headers:this.headers, body:JSON.stringify(body) });
    return res.status;
  }

  async deleteSubdomain(sub) {
    // sub bisa berupa nama penuh atau cuma subdomain
    let domain = sub.toLowerCase();
    if (!domain.endsWith(this.rootDomain)) {
      // misal "ava.game" → "ava.game.example.com"
      domain = `${domain}.${this.rootDomain}`;
    }
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers:this.headers });
    if (!listRes.ok) return listRes.status;

    const { result } = await listRes.json();
    const obj = result.find(d => d.hostname === domain);
    if (!obj) return 404;

    const res = await fetch(`${listUrl}/${obj.id}`, { method:'DELETE', headers:this.headers });
    return res.status;
  }

  // In-memory request CRUD
  saveDomainRequest(r) { globalThis.subdomainRequests.push(r); }
  findPendingRequest(sub, uid=null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === sub && r.status==='pending' &&
      (uid===null || r.requesterId===uid)
    );
  }
  updateRequestStatus(sub, st) {
    const r = globalThis.subdomainRequests.find(r=>r.subdomain===sub && r.status==='pending');
    if (r) r.status = st;
  }
  getAllRequests()    { return [...globalThis.subdomainRequests]; }
  getApprovedDomains(){ return globalThis.subdomainRequests.filter(r=>r.status==='approved').map(r=>r.domain); }
}

// ========================================
// Telegram Bot Handler: TelegramWildcardBot
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token    = token;
    this.apiUrl   = apiUrl  || 'https://api.telegram.org';
    this.ownerId  = ownerId;
    this.globalBot= globalBot;
    this.awaitingDeleteList = {};  // { chatId: true }
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMdV2(text) {
    return this.globalBot?.escapeMarkdownV2
      ? this.globalBot.escapeMarkdownV2(text)
      : text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK',{status:200});

    const m      = update.message;
    const chatId = m.chat.id;
    const text   = m.text?.trim() || '';
    const isOwner= chatId===this.ownerId;
    const now    = new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'});

    // ======== /add ========
    if (text.startsWith('/add ')) {
      const sd = text.split(' ')[1].trim();
      if (!sd) {
        await this.sendMessage(chatId,'⚠️ Sertakan subdomain setelah /add.');
      } else if (isOwner) {
        const st = await this.globalBot.addSubdomain(sd).catch(()=>500);
        const full = `${sd}.${this.globalBot.rootDomain}`;
        await this.sendMessage(chatId,
          st===200
            ? `✅ ${full} berhasil ditambahkan oleh owner.`
            : `❌ Gagal tambah ${full}, status:${st}.`
        );
      } else {
        if (this.globalBot.findPendingRequest(sd,chatId)) {
          await this.sendMessage(chatId,`⚠️ Anda sudah request ${sd}.${this.globalBot.rootDomain}`);
        } else {
          const full = `${sd}.${this.globalBot.rootDomain}`;
          this.globalBot.saveDomainRequest({
            domain: full, subdomain: sd,
            requesterId: chatId,
            requesterUsername: m.from.username||m.from.first_name,
            requestTime: now, status:'pending'
          });
          await this.sendMessage(chatId,
            `✅ Request diterima:\n🔗 ${full}\n👤 @${m.from.username||m.from.first_name}\n📅 ${now}`
          );
          // notify owner
          if (!isOwner) {
            await this.sendMessage(this.ownerId,
              `📬 New request:\n🔗 ${full}\n👤 ID:${chatId}\n📅 ${now}`
            );
          }
        }
      }
      return new Response('OK',{status:200});
    }

    // ======== /del ========
    if (text.startsWith('/del')) {
      if (!isOwner) {
        await this.sendMessage(chatId,'⛔ Anda tidak berwenang.');
        return new Response('OK',{status:200});
      }

      const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

      // Kasus: "/del" saja → prompt user
      if (lines.length===1 && lines[0]==='/del') {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(chatId,
          '📝 Kirim daftar subdomain/full-hostname yang ingin dihapus (satu per baris).\n' +
          'Contoh:\nava.game.naver.com\nzaintest.vuclip.com\n...'
        );
        return new Response('OK',{status:200});
      }

      // Kasus: user kirim "/del" + list di pesan yang sama
      if (lines.length>1) {
        // ambil semua baris setelah yang pertama
        return this._processDeleteList(chatId, lines.slice(1));
      }

      // Kasus: "/del <subdomain>"
      const parts = lines[0].split(' ').filter(Boolean);
      if (parts.length>=2) {
        const sd = parts[1].trim();
        const st = await this.globalBot.deleteSubdomain(sd).catch(()=>500);
        const full = sd.includes('.') ? sd : `${sd}.${this.globalBot.rootDomain}`;
        const emoji = st===200 ? '✅' : st===404 ? '⚠️' : '❌';
        await this.sendMessage(chatId, `${emoji} ${full} ${st===200?'dihapus':'gagal (status:'+st+')'}`);
        return new Response('OK',{status:200});
      }
      // fallback prompt
      this.awaitingDeleteList[chatId] = true;
      await this.sendMessage(chatId,
        '📝 Kirim daftar subdomain/full-hostname yang ingin dihapus (satu per baris).'
      );
      return new Response('OK',{status:200});
    }

    // ======== AFTER-PROMPT: proses daftar ========
    if (this.awaitingDeleteList[chatId]) {
      this.awaitingDeleteList[chatId] = false;
      const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
      return this._processDeleteList(chatId, lines);
    }

    // ======== /list ========
    if (text.startsWith('/list')) {
      const domains = await this.globalBot.getDomainList().catch(()=>[]);
      if (!domains.length) {
        await this.sendMessage(chatId,'📭 Belum ada subdomain terdaftar.');
      } else {
        const out = domains.map((d,i)=>`${i+1}. ${d}`).join('\n');
        await this.sendMessage(chatId, `📋 Daftar (${domains.length}):\n${out}`);
        await this.sendDocument(chatId, out, 'subdomain-list.txt','text/plain');
      }
      return new Response('OK',{status:200});
    }

    // ======== /approve, /reject, /req ========
    // ... (sama seperti sebelumnya) ...

    return new Response('OK',{status:200});
  }

  // helper internal untuk batch delete
  async _processDeleteList(chatId, lines) {
    if (!lines.length) {
      await this.sendMessage(chatId,'⚠️ Tidak ada entri yang valid.');
      return new Response('OK',{status:200});
    }
    let hasil = '';
    for (let d of lines) {
      d = d.toLowerCase();
      if (!d.endsWith(this.globalBot.rootDomain)) {
        hasil += `🔸 ${d} → ❌ Bukan domain [*.${this.globalBot.rootDomain}]\n`;
        continue;
      }
      // potong rootDomain
      const sub = d.slice(0, -(this.globalBot.rootDomain.length+1));
      const st  = await this.globalBot.deleteSubdomain(sub).catch(()=>500);
      hasil += st===200
        ? `✅ ${d} dihapus.\n`
        : st===404
          ? `⚠️ ${d} tidak ditemukan.\n`
          : `❌ ${d} gagal (status:${st}).\n`;
    }
    await this.sendMessage(chatId, `Hasil penghapusan:\n\n${hasil}`);
    return new Response('OK',{status:200});
  }

  async sendMessage(chatId, text, opts={}) {
    const body = { chat_id:chatId, text, ...opts };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const fd = new FormData();
    fd.append('chat_id', chatId.toString());
    fd.append('document', new Blob([content], { type:mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method:'POST', body:fd
    });
  }
}
