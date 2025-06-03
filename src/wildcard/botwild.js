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
    if (!update.message && !update.callback_query) return new Response('OK', { status: 200 });

    // Callback Query Handler (for inline button presses)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;

      // Only owner can delete
      if (callback.from.id !== this.ownerId) {
        await this.answerCallbackQuery(callback.id, '⛔ You are not authorized.');
        return new Response('OK', { status: 200 });
      }

      // Data format: del:NUMBER (e.g. del:3)
      if (data.startsWith('del:')) {
        const indexStr = data.split(':')[1];
        const index = parseInt(indexStr);
        if (isNaN(index)) {
          await this.answerCallbackQuery(callback.id, '❌ Invalid selection.');
          return new Response('OK', { status: 200 });
        }

        // Get current domains list
        let domains = [];
        try {
          domains = await this.globalBot.getDomainList();
        } catch (err) {
          console.error('❌ getDomainList() error:', err);
        }

        if (index < 1 || index > domains.length) {
          await this.answerCallbackQuery(callback.id, '❌ Number out of range.');
          return new Response('OK', { status: 200 });
        }

        // Subdomain to delete: remove rootDomain suffix
        const fullDomain = domains[index - 1];
        const subdomain = fullDomain.endsWith(`.${this.globalBot.rootDomain}`)
          ? fullDomain.slice(0, fullDomain.length - this.globalBot.rootDomain.length - 1)
          : fullDomain;

        let status = 500;
        try {
          status = await this.globalBot.deleteSubdomain(subdomain);
        } catch (err) {
          console.error('❌ deleteSubdomain() error:', err);
        }

        const domainMsg = this.escapeMarkdownV2(fullDomain);
        let replyText = '';
        switch (status) {
          case 200:
            replyText = `\`\`\`Wildcard\n${domainMsg} deleted successfully.\`\`\``;
            break;
          case 404:
            replyText = `⚠️ Subdomain *${domainMsg}* not found.`;
            break;
          default:
            replyText = `❌ Failed to delete *${domainMsg}*, status: \`${status}\``;
        }

        // Edit original message to show result and remove inline buttons
        await this.editMessageText(chatId, messageId, replyText, { parse_mode: 'MarkdownV2' });

        // Answer callback query to remove loading circle on button
        await this.answerCallbackQuery(callback.id, 'Done.');

        return new Response('OK', { status: 200 });
      }

      // If callback data not recognized, just answer
      await this.answerCallbackQuery(callback.id, 'Unknown action.');
      return new Response('OK', { status: 200 });
    }

    // Message Handler
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

      // Authorization
      const unauthorized = (text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId;
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

      // Delete Command: show list with buttons (no direct deletion)
      if (text === '/del') {
        // Get list of domains
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

        // Build message text with numbered list
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');
        const summary = `\n\nSelect the number to delete by clicking the button below.`;
        const messageText = `\`\`\`List-Wildcard\n${formattedList}\`\`\`${summary}`;

        // Build inline keyboard buttons for deletion
        // Telegram max 8 buttons per row recommended; let's do max 4 per row for readability
        const buttons = [];
        const maxButtonsPerRow = 4;
        for (let i = 0; i < domains.length; i++) {
          const btn = {
            text: (i + 1).toString(),
            callback_data: `del:${i + 1}`, // will handle in callback_query
          };
          if (i % maxButtonsPerRow === 0) buttons.push([]);
          buttons[buttons.length - 1].push(btn);
        }

        await this.sendMessage(chatId, messageText, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: buttons,
          },
        });

        return new Response('OK', { status: 200 });
      }

      // List Subdomains (normal /list)
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

  async deleteMessage(chatId, messageId) {
    const payload = { chat_id: chatId, message_id: messageId };
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    };
    await fetch(`${this.apiUrl}/bot${this.token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async answerCallbackQuery(callbackQueryId, text) {
    const payload = { callback_query_id: callbackQueryId, text, show_alert: false };
    await fetch(`${this.apiUrl}/bot${this.token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    // Since no file upload from local, send document as multipart/form-data with Blob or FormData
    // In Deno/Cloudflare Workers, we may need to simulate this
    // For simplicity here, we send text file as a message with markdown or skip

    // Alternative: skip or implement based on your environment
  }
}
