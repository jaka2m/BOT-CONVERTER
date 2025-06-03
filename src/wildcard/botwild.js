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
  constructor(token, apiUrl, ownerId, globalBotInstance) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.globalBot = globalBotInstance;
    this.handleUpdate = this.handleUpdate.bind(this);
    this.handleCallbackQuery = this.handleCallbackQuery.bind(this);
  }

  escapeMarkdownV2(text) {
    if (this.globalBot?.escapeMarkdownV2) {
      return this.globalBot.escapeMarkdownV2(text);
    }
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });

    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Authorization check for add/del commands
    const unauthorized = (text.startsWith('/add ') || text.startsWith('/del')) && chatId !== this.ownerId;
    if (unauthorized) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // Add Subdomain
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      let loadingMsgId;

      try {
        const loadingMsg = await this.sendMessage(chatId, '⏳ Adding subdomain, please wait...');
        loadingMsgId = loadingMsg.result?.message_id;
      } catch (err) {
        console.error('❌ Failed to send loading message:', err);
      }

      let status = 500;
      try {
        status = await this.globalBot.addSubdomain(subdomain);
      } catch (err) {
        console.error('❌ addSubdomain() error:', err);
      }

      if (loadingMsgId) {
        try {
          await this.deleteMessage(chatId, loadingMsgId);
        } catch (err) {
          console.error('❌ Failed to delete loading message:', err);
        }
      }

      const domainMsg = this.escapeMarkdownV2(fullDomain);
      switch (status) {
        case 200:
          await this.sendMessage(chatId, `\`\`\`Wildcard\n${domainMsg} added successfully\`\`\``, { parse_mode: 'MarkdownV2' });
          break;
        case 409:
          await this.sendMessage(chatId, `⚠️ Subdomain *${domainMsg}* already exists.`, { parse_mode: 'MarkdownV2' });
          break;
        case 530:
          await this.sendMessage(chatId, `❌ Subdomain *${domainMsg}* not active (error 530).`, { parse_mode: 'MarkdownV2' });
          break;
        default:
          await this.sendMessage(chatId, `❌ Failed to add *${domainMsg}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Delete Subdomain - two modes:
    // /del without parameter = show list + buttons
    // /del <subdomain> = delete directly
    if (text.startsWith('/del')) {
      const parts = text.split(' ');
      if (parts.length === 1) {
        // Show list with buttons
        let domains = [];
        try {
          domains = await this.globalBot.getDomainList();
        } catch (err) {
          console.error('❌ getDomainList() error:', err);
        }

        if (domains.length === 0) {
          await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
          return new Response('OK', { status: 200 });
        }

        // Create inline keyboard buttons with callback_data = "del:<index>"
        const buttons = [];
        for (let i = 0; i < domains.length; i++) {
          buttons.push([{ text: `${i + 1}`, callback_data: `del:${i}` }]);
        }

        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');
        const summary = `\n\nClick a button below to delete the corresponding subdomain.`;

        await this.sendMessage(chatId,
          `\`\`\`Delete Subdomain List\`\`\`\n${formattedList}${summary}`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: JSON.stringify({ inline_keyboard: buttons }),
          }
        );

        return new Response('OK', { status: 200 });
      } else if (parts.length === 2) {
        // Direct delete by subdomain
        const subdomain = parts[1];
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
    }

    // List Subdomains
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

    // Default fallback
    return new Response('OK', { status: 200 });
  }

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (!data.startsWith('del:')) {
      // Not our callback, ignore
      return new Response('OK', { status: 200 });
    }

    // Authorization: only owner can delete
    if (chatId !== this.ownerId) {
      await this.answerCallbackQuery(callbackQuery.id, { text: '⛔ You are not authorized.' });
      return new Response('OK', { status: 200 });
    }

    // Extract index from callback data "del:<index>"
    const indexStr = data.split(':')[1];
    const index = parseInt(indexStr);
    if (isNaN(index)) {
      await this.answerCallbackQuery(callbackQuery.id, { text: 'Invalid index.' });
      return new Response('OK', { status: 200 });
    }

    // Get current domain list
    let domains = [];
    try {
      domains = await this.globalBot.getDomainList();
    } catch (err) {
      console.error('❌ getDomainList() error:', err);
      await this.answerCallbackQuery(callbackQuery.id, { text: 'Failed to get domain list.' });
      return new Response('OK', { status: 200 });
    }

    if (index < 0 || index >= domains.length) {
      await this.answerCallbackQuery(callbackQuery.id, { text: 'Index out of range.' });
      return new Response('OK', { status: 200 });
    }

    const domainToDelete = domains[index];
    const subdomain = domainToDelete.replace(`.${this.globalBot.rootDomain}`, '');

    let status = 500;
    try {
      status = await this.globalBot.deleteSubdomain(subdomain);
    } catch (err) {
      console.error('❌ deleteSubdomain() error:', err);
    }

    const domainMsg = this.escapeMarkdownV2(domainToDelete);

    if (status === 200) {
      await this.answerCallbackQuery(callbackQuery.id, { text: `✅ Deleted ${domainToDelete}` });
      // Edit message to remove deleted domain from list
      domains.splice(index, 1);

      if (domains.length === 0) {
        // No more domains left, edit message to say empty
        await this.editMessageText(chatId, messageId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [] } });
      } else {
        // Rebuild buttons
        const buttons = [];
        for (let i = 0; i < domains.length; i++) {
          buttons.push([{ text: `${i + 1}`, callback_data: `del:${i}` }]);
        }

        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');

        await this.editMessageText(chatId, messageId,
          `\`\`\`Delete Subdomain List\`\`\`\n${formattedList}\n\nClick a button below to delete the corresponding subdomain.`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: JSON.stringify({ inline_keyboard: buttons }),
          });
      }
    } else if (status === 404) {
      await this.answerCallbackQuery(callbackQuery.id, { text: `⚠️ ${domainToDelete} not found.` });
    } else {
      await this.answerCallbackQuery(callbackQuery.id, { text: `❌ Failed to delete ${domainToDelete}, status: ${status}` });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const params = new URLSearchParams({ chat_id: chatId, text, ...options });
    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage?${params.toString()}`);
    return res.json();
  }

  async deleteMessage(chatId, messageId) {
    const params = new URLSearchParams({ chat_id: chatId, message_id: messageId });
    const res = await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage?${params.toString()}`);
    return res.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    };
    const res = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    const params = new URLSearchParams({ callback_query_id: callbackQueryId, ...options });
    const res = await fetch(`${this.apiUrl}/bot${this.token}/answerCallbackQuery?${params.toString()}`);
    return res.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    // Create multipart/form-data body manually
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).slice(2)}`;
    const crlf = '\r\n';

    let body = '';
    body += `--${boundary}${crlf}`;
    body += `Content-Disposition: form-data; name="chat_id"${crlf}${crlf}`;
    body += `${chatId}${crlf}`;
    body += `--${boundary}${crlf}`;
    body += `Content-Disposition: form-data; name="document"; filename="${filename}"${crlf}`;
    body += `Content-Type: ${mimeType}${crlf}${crlf}`;
    const preamble = new TextEncoder().encode(body);
    const fileContent = new TextEncoder().encode(content);
    const ending = new TextEncoder().encode(`${crlf}--${boundary}--${crlf}`);

    const uint8Array = new Uint8Array(preamble.length + fileContent.length + ending.length);
    uint8Array.set(preamble, 0);
    uint8Array.set(fileContent, preamble.length);
    uint8Array.set(ending, preamble.length + fileContent.length);

    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: uint8Array,
    });
    return res.json();
  }
}
