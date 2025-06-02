const rootDomain = "joss.checker-ip.xyz";

export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, cloudflareConfig) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;

    // Cloudflare config
    this.accountID = cloudflareConfig.accountID;
    this.zoneID = cloudflareConfig.zoneID;
    this.apiKey = cloudflareConfig.apiKey;
    this.apiEmail = cloudflareConfig.apiEmail;
    this.serviceName = cloudflareConfig.serviceName || 'siren';

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email': this.apiEmail,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json'
    };

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  // Escape MarkdownV2 untuk Telegram
  escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  // Ambil list domain dari Cloudflare Workers
  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (res.ok) {
      const json = await res.json();
      return json.result
        .filter(d => d.service === this.serviceName)
        .map(d => d.hostname);
    }
    return [];
  }

  // Tambah subdomain ke Cloudflare Workers
  async addSubdomain(subdomain) {
    const domain = `${subdomain}.${rootDomain}`.toLowerCase();
    if (!domain.endsWith(rootDomain)) return 400;

    const registeredDomains = await this.getDomainList();
    if (registeredDomains.includes(domain)) return 409;

    try {
      const testUrl = `https://${domain.replace(`.${rootDomain}`, '')}`;
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
    const domain = `${subdomain}.${rootDomain}`.toLowerCase();
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
    return await this.getDomainList();
  }

  // ============================
  // Tangani update dari webhook
  // ============================
  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Hanya owner yang bisa /add & /del
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // Handle /add
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
        status = await this.addSubdomain(subdomain);
      } catch (err) {
        console.error('❌ addSubdomain() error:', err);
        status = 500;
      }

      const fullDomain = `${subdomain}.${rootDomain}`;

      if (loadingMsgId) {
        try {
          await this.deleteMessage(chatId, loadingMsgId);
        } catch (err) {
          console.error('❌ Failed to delete loading message:', err);
        }
      }

      if (status === 200) {
        await this.sendMessage(chatId,
          `\`\`\`Wildcard\n${this.escapeMarkdownV2(fullDomain)} added successfully\`\`\``,
          { parse_mode: 'MarkdownV2' });
      } else if (status === 409) {
        await this.sendMessage(chatId,
          `⚠️ Subdomain *${this.escapeMarkdownV2(fullDomain)}* already exists.`,
          { parse_mode: 'MarkdownV2' });
      } else if (status === 530) {
        await this.sendMessage(chatId,
          `❌ Subdomain *${this.escapeMarkdownV2(fullDomain)}* not active (error 530).`,
          { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId,
          `❌ Failed to add *${this.escapeMarkdownV2(fullDomain)}*, status: \`${status}\``,
          { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle /del
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) return new Response('OK', { status: 200 });

      const status = await this.deleteSubdomain(subdomain);
      const fullDomain = `${subdomain}.${rootDomain}`;

      if (status === 200) {
        await this.sendMessage(chatId,
          `\`\`\`Wildcard\n${this.escapeMarkdownV2(fullDomain)} deleted successfully.\`\`\``,
          { parse_mode: 'MarkdownV2' });
      } else if (status === 404) {
        await this.sendMessage(chatId,
          `⚠️ Subdomain *${this.escapeMarkdownV2(fullDomain)}* not found.`,
          { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId,
          `❌ Failed to delete *${this.escapeMarkdownV2(fullDomain)}*, status: \`${status}\``,
          { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle /list
    if (text.startsWith('/list')) {
      const domains = await this.listSubdomains();

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');
        const totalLine = `\n\nTotal: *${domains.length}* subdomain${domains.length > 1 ? 's' : ''}`;
        const textPreview = `\`\`\`List-Wildcard\n${formattedList}\`\`\`` + totalLine;

        await this.sendMessage(chatId, textPreview, { parse_mode: 'MarkdownV2' });

        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }

      return new Response('OK', { status: 200 });
    }

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
