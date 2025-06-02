// ========================================
// Utilities
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

// ========================================
// CloudflareBot Class
// ========================================
export class CloudflareBot {
  constructor({ rootDomain, apiKey, apiEmail, accountID, zoneID, serviceName }) {
    this.rootDomain = rootDomain;
    this.apiKey = apiKey;
    this.apiEmail = apiEmail;
    this.accountID = accountID;
    this.zoneID = zoneID;
    this.serviceName = serviceName;

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
// TelegramWildcardBot Class
// ========================================
export class TelegramWildcardBot {
  constructor(token, cloudflareBot, ownerId, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.cloudflareBot = cloudflareBot;
    this.ownerId = ownerId;
    this.apiUrl = apiUrl;
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    const isOwner = chatId === this.ownerId;

    // Handle /add
    if (text.startsWith('/add ')) {
      if (!isOwner) return this.sendMessage(chatId, '⛔ You are not authorized to use this command.');

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const msg = await this.sendMessage(chatId, '⏳ Adding subdomain...');
      const loadingMsgId = msg.result?.message_id;

      const status = await this.cloudflareBot.addSubdomain(subdomain);
      const fullDomain = `${subdomain}.${this.cloudflareBot.rootDomain}`;

      if (loadingMsgId) await this.deleteMessage(chatId, loadingMsgId);

      if (status === 200) {
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(fullDomain)} added successfully\`\`\``, { parse_mode: 'MarkdownV2' });
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* already exists.`, { parse_mode: 'MarkdownV2' });
      } else if (status === 530) {
        await this.sendMessage(chatId, `❌ Subdomain *${escapeMarkdownV2(fullDomain)}* not active (530).`, { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId, `❌ Failed to add *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle /del
    if (text.startsWith('/del ')) {
      if (!isOwner) return this.sendMessage(chatId, '⛔ You are not authorized to use this command.');

      const subdomain = text.split(' ')[1]?.trim();
      const status = await this.cloudflareBot.deleteSubdomain(subdomain);
      const fullDomain = `${subdomain}.${this.cloudflareBot.rootDomain}`;

      if (status === 200) {
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(fullDomain)} deleted successfully.\`\`\``, { parse_mode: 'MarkdownV2' });
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* not found.`, { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle /list
    if (text.startsWith('/list')) {
      const domains = await this.cloudflareBot.getDomainList();
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
