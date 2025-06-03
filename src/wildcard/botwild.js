// ========================================
// Main Telegram Wildcard Bot Entry Point
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Global Constants for Cloudflare API
// ========================================
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

    // Simulasi penyimpanan request domain (gunakan DB nyata di implementasi sesungguhnya)
    this._requests = [];
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

  // ----- tambahan globalBot -----

  async saveDomainRequest(request) {
    // request = { domain, requesterId, requesterUsername, requestTime, status, subdomain }
    this._requests.push(request);
  }

  async findPendingRequest(subdomain, requesterId = null) {
    return this._requests.find(r =>
      r.subdomain === subdomain && r.status === 'pending' &&
      (requesterId === null || r.requesterId === requesterId));
  }

  async updateRequestStatus(subdomain, status) {
    const req = this._requests.find(r => r.subdomain === subdomain && r.status === 'pending');
    if (req) req.status = status;
  }

  async getApprovedDomainList() {
    return this._requests.filter(r => r.status === 'approved').map(r => r.domain);
  }
}

// ========================================
// Telegram Bot Handler
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBotInstance) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.globalBot = globalBotInstance;
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    if (this.globalBot?.escapeMarkdownV2) {
      return this.globalBot.escapeMarkdownV2(text);
    }
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const fromUser = update.message.from;
    const username = fromUser.username || fromUser.first_name || 'Unknown';
    const text = update.message.text || '';

    const isOwner = chatId === this.ownerId;

    // Command /add
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /add.');
        return new Response('OK', { status: 200 });
      }

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      if (isOwner) {
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

      try {
        const existingRequest = await this.globalBot.findPendingRequest(subdomain, chatId);
        if (existingRequest) {
          await this.sendMessage(chatId, `⚠️ Anda sudah mengirim request untuk domain *${fullDomain}* dan masih menunggu approval.`, { parse_mode: 'Markdown' });
          return new Response('OK', { status: 200 });
        }
      } catch (err) {
        console.error('Error checking existing request:', err);
      }

      const msgRequest = 
`✅ Request domain berhasil dikirim!

🔗 Domain: ${fullDomain}
👤 Requester: @${username}
📅 Time: ${now}

⏳ Status: Menunggu approval admin
📬 Admin akan dinotifikasi untuk approve/reject request Anda

💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.`;

      await this.sendMessage(chatId, msgRequest);

      try {
        await this.globalBot.saveDomainRequest({
          domain: fullDomain,
          requesterId: chatId,
          requesterUsername: username,
          requestTime: now,
          status: 'pending',
          subdomain,
        });
      } catch (err) {
        console.error('Error saving domain request:', err);
      }

      if (this.ownerId && this.ownerId !== chatId) {
        const adminNotif = 
`📬 Permintaan subdomain baru!

🔗 Domain: ${fullDomain}
👤 Pengguna: @${username} (ID: ${chatId})
📅 Waktu: ${now}

Silakan approve/reject melalui dashboard atau bot.`;

        try {
          await this.sendMessage(this.ownerId, adminNotif);
        } catch (e) {
          console.error('❌ Gagal kirim notifikasi ke admin:', e);
        }
      }

      return new Response('OK', { status: 200 });
    }

    // Command /del
    if (text.startsWith('/del ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      let status = 500;

      try {
        status = await this.globalBot.deleteSubdomain(subdomain);
      } catch (err) {
        console.error('❌ deleteSubdomain() error:', err);
      }

      const domainMsg = this.escapeMarkdownV2(fullDomain);
      switch (status) {
        case 200:
          await this.sendMessage(chatId, `\`\`\`Wildcard\n${domainMsg} deleted successfully.\`\`\``, { parse_mode: 'MarkdownV2' });
          break;
        case 404:
          await this.sendMessage(chatId, `⚠️ Subdomain *${domainMsg}* not found.`, { parse_mode: 'MarkdownV2' });
          break;
        default:
          await this.sendMessage(chatId, `❌ Failed to delete *${domainMsg}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }
      return new Response('OK', { status: 200 });
    }

    // Command /list
    if (text.startsWith('/list')) {
      let domains = [];
      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('❌ getDomainList() error:', err);
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

    // Command /approve
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      try {
        const request = await this.globalBot.findPendingRequest(subdomain);
        if (!request) {
          await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${fullDomain}*.`, { parse_mode: 'Markdown' });
          return new Response('OK', { status: 200 });
        }

        const status = await this.globalBot.addSubdomain(subdomain);

        if (status === 200) {
          await this.globalBot.updateRequestStatus(subdomain, 'approved');

          await this.sendMessage(chatId, `✅ Domain *${fullDomain}* telah disetujui dan ditambahkan.`, { parse_mode: 'Markdown' });

          await this.sendMessage(request.requesterId,
            `✅ Permintaan domain *${fullDomain}* Anda telah disetujui oleh admin pada:\n${now}`,
            { parse_mode: 'Markdown' });
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${fullDomain}*, status: ${status}`, { parse_mode: 'Markdown' });
        }
      } catch (err) {
        console.error('Error approve:', err);
        await this.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses approve.');
      }

      return new Response('OK', { status: 200 });
    }

    // Command /reject
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      try {
        const request = await this.globalBot.findPendingRequest(subdomain);
        if (!request) {
          await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${fullDomain}*.`, { parse_mode: 'Markdown' });
          return new Response('OK', { status: 200 });
        }

        await this.globalBot.updateRequestStatus(subdomain, 'rejected');

        await this.sendMessage(chatId, `❌ Permintaan domain *${fullDomain}* telah ditolak.`, { parse_mode: 'Markdown' });

        await this.sendMessage(request.requesterId,
          `❌ Permintaan domain *${fullDomain}* Anda telah ditolak oleh admin pada:\n${now}`,
          { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Error reject:', err);
        await this.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses reject.');
      }

      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      text,
      ...options,
    };

    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([content], { type: mimeType }), filename);

    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
  }
}
