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
    // Telegram update might be a message or a callback_query
    if (update.message) {
      return this.handleMessage(update.message);
    } else if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }
    return new Response('OK', { status: 200 });
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text || '';

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

    // Delete Subdomain
    if (text.startsWith('/del')) {
      const args = text.split(' ').slice(1);
      if (args.length === 0 || !args[0]) {
        // User sent only /del without argument => show list with inline buttons "Hapus"
        let domains = [];
        try {
          domains = await this.globalBot.getDomainList();
        } catch (err) {
          console.error('❌ getDomainList() error:', err);
        }

        if (domains.length === 0) {
          await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
        } else {
          // Build message with numbered list
          const formattedList = domains
            .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
            .join('\n');
          const summary = `\n\n*Klik tombol hapus sesuai nomor untuk menghapus subdomain.*`;

          // Build inline keyboard with buttons "Hapus" for each subdomain
          const inline_keyboard = domains.map((d, i) => ([
            {
              text: `Hapus ${i + 1}`,
              callback_data: `delete_${i}` // encode index for callback
            }
          ]));

          await this.sendMessage(chatId,
            `\`\`\`Subdomain List\`\`\`\n${formattedList}${summary}`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard } }
          );
        }
        return new Response('OK', { status: 200 });
      }

      // If user send /del <number> directly (optional fallback)
      const num = parseInt(args[0], 10);
      if (isNaN(num)) {
        await this.sendMessage(chatId, '❌ Nomor yang Anda masukkan tidak valid.');
        return new Response('OK', { status: 200 });
      }

      // Just delete the subdomain by number (1-based index)
      let domains = [];
      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('❌ getDomainList() error:', err);
      }
      if (num < 1 || num > domains.length) {
        await this.sendMessage(chatId, '❌ Nomor di luar daftar.');
        return new Response('OK', { status: 200 });
      }
      const fullDomain = domains[num - 1];
      const subdomain = fullDomain.replace(`.${this.globalBot.rootDomain}`, '');

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

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const fromId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Only owner can delete subdomain
    if (fromId !== this.ownerId) {
      // Answer callback with alert
      await this.answerCallbackQuery(callbackQuery.id, { text: '⛔ You are not authorized.', show_alert: true });
      return new Response('OK', { status: 200 });
    }

    if (data && data.startsWith('delete_')) {
      // Parse index from callback_data
      const index = parseInt(data.split('_')[1], 10);
      if (isNaN(index)) {
        await this.answerCallbackQuery(callbackQuery.id, { text: '❌ Invalid index.', show_alert: true });
        return new Response('OK', { status: 200 });
      }

      let domains = [];
      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('❌ getDomainList() error:', err);
      }

      if (index < 0 || index >= domains.length) {
        await this.answerCallbackQuery(callbackQuery.id, { text: '❌ Index out of range.', show_alert: true });
        return new Response('OK', { status: 200 });
      }

      const fullDomain = domains[index];
      const subdomain = fullDomain.replace(`.${this.globalBot.rootDomain}`, '');

      let status = 500;
      try {
        status = await this.globalBot.deleteSubdomain(subdomain);
      } catch (err) {
        console.error('❌ deleteSubdomain() error:', err);
      }

      if (status === 200) {
        // Update the message text by removing deleted subdomain from the list
        domains.splice(index, 1);

        if (domains.length === 0) {
          // No subdomains left
          await this.editMessageText(chatId, messageId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [] } });
        } else {
          const formattedList = domains
            .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
            .join('\n');
          const summary = `\n\n*Klik tombol hapus sesuai nomor untuk menghapus subdomain.*`;

          const inline_keyboard = domains.map((d, i) => ([
            {
              text: `Hapus ${i + 1}`,
              callback_data: `delete_${i}`
            }
          ]));

          await this.editMessageText(chatId, messageId,
            `\`\`\`Subdomain List\`\`\`\n${formattedList}${summary}`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard } }
          );
        }

        await this.answerCallbackQuery(callbackQuery.id, { text: `✅ Subdomain ${this.escapeMarkdownV2(fullDomain)} deleted.`, show_alert: false });
      } else {
        await this.answerCallbackQuery(callbackQuery.id, { text: `❌ Failed to delete subdomain. Status: ${status}`, show_alert: true });
      }

      return new Response('OK', { status: 200 });
    }

    // Unknown callback
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const params = {
      chat_id: chatId,
      text,
      ...options,
    };
    const url = `${this.apiUrl}/bot${this.token}/sendMessage?parse_mode=MarkdownV2`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const params = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    };
    const url = `${this.apiUrl}/bot${this.token}/editMessageText?parse_mode=MarkdownV2`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    const params = {
      callback_query_id: callbackQueryId,
      ...options,
    };
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
