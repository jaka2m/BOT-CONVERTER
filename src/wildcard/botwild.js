// ========================================
// Main Telegram Wildcard Bot Entry Point
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Global Constants for Cloudflare API
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
  }

  escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
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

    const registeredDomains = await this.getDomainList();
    if (registeredDomains.includes(domain)) return 409;

    try {
      const testUrl = `https://${subdomain}`;
      const domainTest = await fetch(testUrl);
      if (domainTest.status === 530) return 530;
    } catch {
      return 400;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname: domain,
      service: this.serviceName,
      zone_id: this.zoneID,
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    return res.status;
  }

  async deleteSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();
    const urlList = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;

    const listRes = await fetch(urlList, { headers: this.headers });
    if (!listRes.ok) return listRes.status;

    const listJson = await listRes.json();
    const domainObj = listJson.result.find(d => d.hostname === domain);
    if (!domainObj) return 404;

    const urlDelete = `${urlList}/${domainObj.id}`;
    const res = await fetch(urlDelete, {
      method: 'DELETE',
      headers: this.headers,
    });

    return res.status;
  }
}

// ========================================
// Telegram Bot Handler
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, adminChatId, globalBotInstance) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId; // owner user id (admin)
    this.adminChatId = adminChatId; // chat id admin untuk notif
    this.globalBot = globalBotInstance;

    this.handleUpdate = this.handleUpdate.bind(this);

    // Dummy in-memory request storage
    this.pendingRequests = []; // { domain, requesterId, requesterUsername, requestTime, status }
  }

  escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const fromUser = update.message.from;
    const username = fromUser.username || fromUser.first_name || 'Unknown';
    const text = update.message.text || '';

    const isOwner = chatId === this.ownerId;

    // === /add subdomain ===
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /add.');
        return new Response('OK', { status: 200 });
      }

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      if (isOwner) {
        // Owner langsung proses tanpa request
        let status = 500;
        try {
          status = await this.globalBot.addSubdomain(subdomain);
        } catch (e) {
          console.error('addSubdomain error:', e);
        }

        if (status === 200) {
          await this.sendMessage(chatId, `✅ Domain *${fullDomain}* berhasil ditambahkan oleh owner.`, { parse_mode: 'Markdown' });
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${fullDomain}*, status: ${status}`, { parse_mode: 'Markdown' });
        }
        return new Response('OK', { status: 200 });
      }

      // Cek apakah request sudah ada dan pending
      const existingRequest = this.pendingRequests.find(r => r.domain === fullDomain && r.requesterId === chatId && r.status === 'pending');
      if (existingRequest) {
        await this.sendMessage(chatId, `⚠️ Anda sudah mengirim request untuk domain *${fullDomain}* dan masih menunggu approval.`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      // Simpan request
      this.pendingRequests.push({
        domain: fullDomain,
        requesterId: chatId,
        requesterUsername: username,
        requestTime: now,
        status: 'pending',
      });

      // Kirim pesan ke requester
      await this.sendMessage(chatId,
`✅ Request domain berhasil dikirim!

🔗 Domain: ${fullDomain}
👤 Requester: @${username}
📅 Time: ${now}

⏳ Status: Menunggu approval admin
📬 Admin akan dinotifikasi untuk approve/reject request Anda

💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.`);

      // Kirim notif ke admin
      await this.sendMessage(this.adminChatId,
`📥 Request subdomain baru masuk:

🔗 Domain: *${fullDomain}*
👤 Requester: @${username}
📅 Time: ${now}

Gunakan /approve ${subdomain} atau /reject ${subdomain} untuk proses.` , { parse_mode: 'Markdown' });

      return new Response('OK', { status: 200 });
    }

    // === /approve subdomain ===
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /approve.');
        return new Response('OK', { status: 200 });
      }

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const request = this.pendingRequests.find(r => r.domain === fullDomain && r.status === 'pending');

      if (!request) {
        await this.sendMessage(chatId, `⚠️ Request untuk domain *${fullDomain}* tidak ditemukan atau sudah diproses.`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      try {
        await this.globalBot.addSubdomain(subdomain);
        request.status = 'approved';
      } catch (e) {
        console.error('Approve error:', e);
        await this.sendMessage(chatId, `❌ Gagal approve domain *${fullDomain}*`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      await this.sendMessage(chatId, `✅ Domain *${fullDomain}* sudah disetujui dan aktif.`, { parse_mode: 'Markdown' });

      // Notif ke requester
      await this.sendMessage(request.requesterId,
        `✅ Permintaan subdomain *${fullDomain}* Anda sudah disetujui oleh admin. Anda sekarang bisa menggunakannya.`,
        { parse_mode: 'Markdown' });

      return new Response('OK', { status: 200 });
    }

    // === /reject subdomain ===
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /reject.');
        return new Response('OK', { status: 200 });
      }

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const request = this.pendingRequests.find(r => r.domain === fullDomain && r.status === 'pending');

      if (!request) {
        await this.sendMessage(chatId, `⚠️ Request untuk domain *${fullDomain}* tidak ditemukan atau sudah diproses.`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      request.status = 'rejected';

      await this.sendMessage(chatId, `❌ Domain *${fullDomain}* telah ditolak.`, { parse_mode: 'Markdown' });

      // Notif ke requester
      await this.sendMessage(request.requesterId,
        `❌ Maaf, permintaan subdomain *${fullDomain}* Anda ditolak oleh admin.`,
        { parse_mode: 'Markdown' });

      return new Response('OK', { status: 200 });
    }

    // === /list ===
    if (text.startsWith('/list')) {
      let domains = [];
      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('getDomainList() error:', err);
      }

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');
        const summary = `\n\nTotal: *${domains.length}* subdomain${domains.length > 1 ? 's' : ''}`;
        await this.sendMessage(chatId, `\`\`\`List-Wildcard\n${formattedList}\`\`\`${summary}`, { parse_mode: 'MarkdownV2' });

        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // Default fallback
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
}
