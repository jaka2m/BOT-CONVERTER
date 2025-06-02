// ========================================
// Main Telegram Wildcard Bot class
// ========================================

export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Cloudflare Bot Class
// ========================================

export class CloudflareBot {
  constructor(rootDomain, apiKey, accountID, apiEmail, serviceName, zoneID) {
    this.rootDomain = rootDomain;
    this.apiKey = apiKey;
    this.accountID = accountID;
    this.apiEmail = apiEmail;
    this.serviceName = serviceName;
    this.zoneID = zoneID;

    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'X-Auth-Email': apiEmail,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    };
  }

  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (res.ok) {
      const json = await res.json();
      return json.result.filter(d => d.service === this.serviceName).map(d => d.hostname);
    }
    return [];
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
      zone_id: this.zoneID
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body)
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
      headers: this.headers
    });

    return res.status;
  }
}

// ========================================
// Escape MarkdownV2 Helper
// ========================================

function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

// ========================================
// Telegram Wildcard Bot Handler Class
// ========================================

export class TelegramWildcardBot {
  constructor(token, rootDomain, cfBotInstance, ownerId, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
    this.ownerId = ownerId;
    this.rootDomain = rootDomain;
    this.cfBot = cfBotInstance; // instance dari CloudflareBot
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Authorization check
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // Handle /add
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.rootDomain}`;
      let loadingMsgId;

      try {
        const loadingMsg = await this.sendMessage(chatId, '⏳ Adding subdomain, please wait...');
        loadingMsgId = loadingMsg.result?.message_id;
      } catch (err) {
        console.error('❌ Failed to send loading message:', err);
      }

      let status;
      try {
        status = await this.cfBot.addSubdomain(subdomain);
      } catch (err) {
        console.error('❌ addSubdomain() error:', err);
        status = 500;
      }

      if (loadingMsgId) {
        try {
          await this.deleteMessage(chatId, loadingMsgId);
        } catch (err) {
          console.error('❌ Failed to delete loading message:', err);
        }
      }

      const escaped = escapeMarkdownV2(fullDomain);
      const responses = {
        200: `\`\`\`Wildcard\n${escaped} added successfully\`\`\``,
        409: `⚠️ Subdomain *${escaped}* already exists.`,
        530: `❌ Subdomain *${escaped}* not active (error 530).`
      };

      const msg = responses[status] || `❌ Failed to add *${escaped}*, status: \`${status}\``;
      await this.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
      return new Response('OK', { status: 200 });
    }

    // Handle /del
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1]?.trim();
      const fullDomain = `${subdomain}.${this.rootDomain}`;
      const status = await this.cfBot.deleteSubdomain(subdomain);
      const escaped = escapeMarkdownV2(fullDomain);

      const responses = {
        200: `\`\`\`Wildcard\n${escaped} deleted successfully.\`\`\``,
        404: `⚠️ Subdomain *${escaped}* not found.`
      };

      const msg = responses[status] || `❌ Failed to delete *${escaped}*, status: \`${status}\``;
      await this.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
      return new Response('OK', { status: 200 });
    }

    // Handle /list
    if (text.startsWith('/list')) {
      const domains = await this.cfBot.getDomainList();

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const formattedList = domains.map((d, i) => `${i + 1}\\. ${escapeMarkdownV2(d)}`).join('\n');
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

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  }

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
