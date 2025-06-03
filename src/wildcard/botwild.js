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
  }

  escapeMarkdownV2(text) {
    if (this.globalBot?.escapeMarkdownV2) {
      return this.globalBot.escapeMarkdownV2(text);
    }
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    // Handle callback_query for delete buttons
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const fromId = update.callback_query.from.id;
      const data = update.callback_query.data;

      if (fromId !== this.ownerId) {
        // Not authorized to delete
        await this.answerCallbackQuery(update.callback_query.id, '⛔ Not authorized.');
        return new Response('OK', { status: 200 });
      }

      if (data.startsWith('del_subdomain_')) {
        const subdomain = data.replace('del_subdomain_', '');

        // Delete subdomain
        let status = 500;
        try {
          status = await this.globalBot.deleteSubdomain(subdomain);
        } catch (e) {
          console.error('Error deleting subdomain:', e);
        }

        const domainFull = `${subdomain}.${this.globalBot.rootDomain}`;
        const domainEscaped = this.escapeMarkdownV2(domainFull);

        if (status === 200) {
          // Edit original message to show success and remove the button for that subdomain
          const newText = `✅ Subdomain *${domainEscaped}* deleted successfully.`;
          await this.editMessageText(chatId, messageId, newText, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [] } });
          await this.answerCallbackQuery(update.callback_query.id, 'Deleted successfully.');
        } else if (status === 404) {
          await this.answerCallbackQuery(update.callback_query.id, '⚠️ Subdomain not found.');
        } else {
          await this.answerCallbackQuery(update.callback_query.id, `❌ Failed to delete. Status: ${status}`);
        }

        return new Response('OK', { status: 200 });
      }

      return new Response('OK', { status: 200 });
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Authorization
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

    // Delete Subdomain command without args -> show list with buttons
    if (text.startsWith('/del') && text.trim() === '/del') {
      let domains = [];

      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('❌ getDomainList() error:', err);
      }

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        // Create inline keyboard with buttons to delete each subdomain
        // Format: { text: '1. subdomain.domain.com', callback_data: 'del_subdomain_subdomain' }
        const inlineKeyboard = [];
        domains.forEach((domain, idx) => {
          // extract subdomain part (remove rootDomain suffix)
          let subdomain = domain;
          if (domain.endsWith(`.${this.globalBot.rootDomain}`)) {
            subdomain = domain.slice(0, domain.length - this.globalBot.rootDomain.length - 1);
          }
          inlineKeyboard.push([{ text: `${idx + 1}. ${domain}`, callback_data: `del_subdomain_${subdomain}` }]);
        });

        await this.sendMessage(chatId, '*Select subdomain to delete:*', {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      return new Response('OK', { status: 200 });
    }

    // Delete Subdomain with argument (fallback - like old behavior)
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
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

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = { chat_id: chatId, message_id: messageId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  }

  async answerCallbackQuery(callbackQueryId, text = '') {
    await fetch(`${this.apiUrl}/bot${this.token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  }

  async sendDocument(chatId, content, filename, mimeType = 'text/plain') {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);

    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
  }
}
