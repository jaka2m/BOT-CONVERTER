// ========================================
// Main Telegram Wildcard Bot class
// ========================================

export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

export class AsuBabibot {
  constructor(rootDomain, apiKey, accountID, zoneID, apiEmail, serviceName) {
    this.rootDomain = rootDomain;
    this.apiKey = apiKey;
    this.accountID = accountID;
    this.zoneID = zoneID;
    this.apiEmail = apiEmail;
    this.serviceName = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email': this.apiEmail,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  // Escape MarkdownV2 untuk Telegram
  _escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  // Ambil daftar domain dari Cloudflare Workers yang sesuai serviceName
  async _getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch domain list: ${res.status}`);
    }
    const json = await res.json();
    return json.result
      .filter(d => d.service === this.serviceName)
      .map(d => d.hostname);
  }

  // Tambah subdomain ke Cloudflare Workers
  async addSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();

    if (!domain.endsWith(this.rootDomain)) return 400;

    const registeredDomains = await this._getDomainList();
    if (registeredDomains.includes(domain)) return 409;

    // Cek status domain via HTTPS
    try {
      const testUrl = `https://${subdomain}`; // subdomain saja tanpa rootDomain di sini
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
      zone_id: this.zoneID
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    return res.status;
  }

  // Hapus subdomain dari Cloudflare Workers
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
      headers: this.headers
    });

    return res.status;
  }

  // Ambil semua subdomain terdaftar
  async listSubdomains() {
    return await this._getDomainList();
  }
}

// ========================================
// Telegram Bot Handler Class
// ========================================

export class TelegramWildcardBot {
  constructor(token, ownerId, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.ownerId = ownerId;

    // Bind handleUpdate agar bisa dipakai sebagai handler webhook
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  // Escape MarkdownV2 untuk Telegram (gunakan method dari AsuBabibot atau buat sendiri)
  _escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  /// ============================
  // Tangani update dari webhook
  // ============================
  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Batasi akses /add dan /del hanya untuk owner
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // Handle perintah /add
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      let loadingMsgId;
      try {
        const loadingMsg = await this.sendMessage(chatId, '⏳ Adding subdomain, please wait...');
        loadingMsgId = loadingMsg.result?.message_id;
      } catch (err) {
        console.error('❌ Failed to send loading message:', err);
      }

      let status;
      try {
        status = await asuBabibotInstance.addSubdomain(subdomain);
      } catch (err) {
        console.error('❌ addSubdomain() error:', err);
        status = 500;
      }

      const fullDomain = `${subdomain}.${asuBabibotInstance.rootDomain}`;
      const escDomain = this._escapeMarkdownV2(fullDomain);

      if (loadingMsgId) {
        try {
          await this.deleteMessage(chatId, loadingMsgId);
        } catch (err) {
          console.error('❌ Failed to delete loading message:', err);
        }
      }

      if (status === 200) {
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escDomain} added successfully\`\`\``, { parse_mode: 'MarkdownV2' });
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escDomain}* already exists.`, { parse_mode: 'MarkdownV2' });
      } else if (status === 530) {
        await this.sendMessage(chatId, `❌ Subdomain *${escDomain}* not active (error 530).`, { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId, `❌ Failed to add *${escDomain}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle perintah /del
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      let status;
      try {
        status = await asuBabibotInstance.deleteSubdomain(subdomain);
      } catch (err) {
        console.error('❌ deleteSubdomain() error:', err);
        status = 500;
      }

      const fullDomain = `${subdomain}.${asuBabibotInstance.rootDomain}`;
      const escDomain = this._escapeMarkdownV2(fullDomain);

      if (status === 200) {
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escDomain} deleted successfully.\`\`\``, { parse_mode: 'MarkdownV2' });
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escDomain}* not found.`, { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete *${escDomain}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle perintah /list
    if (text.startsWith('/list')) {
      let domains = [];
      try {
        domains = await asuBabibotInstance.listSubdomains();
      } catch (err) {
        console.error('❌ listSubdomains() error:', err);
      }

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this._escapeMarkdownV2(d)}`)
          .join('\n');
        const totalLine = `\n\nTotal: *${domains.length}* subdomain${domains.length > 1 ? 's' : ''}`;
        const textPreview = `\`\`\`List-Wildcard\n${formattedList}\`\`\`` + totalLine;

        await this.sendMessage(chatId, textPreview, { parse_mode: 'MarkdownV2' });

        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }

      return new Response('OK', { status: 200 });
    }

    // Default response
    return new Response('OK', { status: 200 });
  }

  // Kirim pesan ke Telegram
  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  // Hapus pesan Telegram
  async deleteMessage(chatId, messageId) {
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  }

  // Kirim file ke Telegram
  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }
}
