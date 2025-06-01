export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

const rootDomain = "joss.checker-ip.xyz";

// Escape untuk MarkdownV2 Telegram agar aman
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

export class TelegramWildcardBot {
  constructor(token, apiUrl = 'https://api.telegram.org', ownerId) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.ownerId = ownerId;

    // Cloudflare config
    this.apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
    this.accountID = "e9930d5ca683b0461f73477050fee0c7";
    this.zoneID = "80423e7547d2fa85e13796a1f41deced";
    this.apiEmail = "ambebalong@gmail.com";
    this.serviceName = "siren";

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email': this.apiEmail,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // ⛔ Batasi /add dan /del hanya untuk owner
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

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
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(fullDomain)} added successfully\`\`\``, {
          parse_mode: 'MarkdownV2'
        });
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* already exists.`, {
          parse_mode: 'MarkdownV2'
        });
      } else if (status === 530) {
        await this.sendMessage(chatId, `❌ Subdomain *${escapeMarkdownV2(fullDomain)}* not active (error 530).`, {
          parse_mode: 'MarkdownV2'
        });
      } else {
        await this.sendMessage(chatId, `❌ Failed to add *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, {
          parse_mode: 'MarkdownV2'
        });
      }

      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      let status;
      try {
        status = await this.deleteSubdomain(subdomain);
      } catch (err) {
        console.error('❌ deleteSubdomain() error:', err);
        status = 500;
      }

      const fullDomain = `${subdomain}.${rootDomain}`;

      if (status === 200) {
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(fullDomain)} deleted successfully.\`\`\``, {
          parse_mode: 'MarkdownV2'
        });
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* not found.`, {
          parse_mode: 'MarkdownV2'
        });
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, {
          parse_mode: 'MarkdownV2'
        });
      }

      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      let domains = [];
      try {
        domains = await this.listSubdomains();
      } catch (err) {
        console.error('❌ listSubdomains() error:', err);
        await this.sendMessage(chatId, '❌ Failed to retrieve subdomain list.');
        return new Response('OK', { status: 200 });
      }

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', {
          parse_mode: 'MarkdownV2'
        });
      } else {
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${escapeMarkdownV2(d)}`)
          .join('\n');

        const totalLine = `\n\nTotal: *${domains.length}* subdomain${domains.length > 1 ? 's' : ''}`;
        const textPreview = `\`\`\`List-Wildcard\n${formattedList}\`\`\`` + totalLine;

        await this.sendMessage(chatId, textPreview, {
          parse_mode: 'MarkdownV2'
        });

        // Kirim juga sebagai dokumen .txt
        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }

      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      text,
      ...options
    };

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
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

  // === Cloudflare API calls ===

  // Dapatkan list subdomain aktif
  async listSubdomains() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (res.ok) {
      const json = await res.json();
      return json.result
        .filter(d => d.service === this.serviceName)
        .map(d => d.hostname);
    }
    throw new Error(`Failed to fetch domain list, status ${res.status}`);
  }

  // Tambahkan subdomain
  async addSubdomain(subdomain) {
    const domain = `${subdomain}.${rootDomain}`.toLowerCase();

    if (!domain.endsWith(rootDomain)) return 400;

    const registeredDomains = await this.listSubdomains();
    if (registeredDomains.includes(domain)) return 409;

    // Cek domain dengan request ke domain tanpa rootDomain
    try {
      const testUrl = `https://${subdomain}`;
      const domainTest = await fetch(testUrl);
      if (domainTest.status === 530) return 530;
    } catch {
      // Network error atau domain tidak dapat diakses
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

  // Hapus subdomain
  async deleteSubdomain(subdomain) {
    const domain = `${subdomain}.${rootDomain}`.toLowerCase();

    const urlList = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(urlList, { headers: this.headers });
    if (!listRes.ok) return listRes.status;

    const listJson = await listRes.json();
    const domainObj = listJson.result.find(d => d.hostname === domain);
    if (!domainObj) return 404;

    const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains/${domainObj.id}`;
    const res = await fetch(urlDelete, {
      method: 'DELETE',
      headers: this.headers
    });

    return res.status;
  }
}
