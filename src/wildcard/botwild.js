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
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/add ')) {
  const subdomain = text.split(' ')[1]?.trim();
  if (!subdomain) return new Response('OK', { status: 200 });

  const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
  const domainMsg = this.escapeMarkdownV2(fullDomain);
  const requester = `@${from.username || from.first_name}`;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });

  // Jika pemilik bot
  if (chatId === this.ownerId) {
    let status = 500;
    try {
      status = await this.globalBot.addSubdomain(subdomain);
    } catch (err) {
      console.error('❌ addSubdomain() error:', err);
    }

    if (status === 200) {
      await this.sendMessage(chatId, `✅ Subdomain *${domainMsg}* berhasil ditambahkan (admin bypass).`, { parse_mode: 'MarkdownV2' });
    } else {
      await this.sendMessage(chatId, `❌ Gagal menambahkan *${domainMsg}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
    }

    return new Response('OK', { status: 200 });
  }

  // Jika user biasa (harus approval admin)
  await this.sendMessage(chatId, 
`✅ Request domain berhasil dikirim!

🔗 Domain: ${fullDomain}
👤 Requester: ${requester}
📅 Time: ${timestamp}

⏳ Status: Menunggu approval admin
📬 Admin akan dinotifikasi untuk approve/reject request Anda

💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.`
  );

  // Kirim ke admin
  const adminNotif = await this.sendMessage(this.ownerId,
`📥 *Permintaan subdomain baru*

🔗 Domain: *${domainMsg}*
👤 Dari: ${requester}
📅 Waktu: ${timestamp}

✅ Approve: /approve ${subdomain} ${chatId}
❌ Reject: /reject ${subdomain} ${chatId}`,
    { parse_mode: 'MarkdownV2' }
  );

  // Simpan ke pendingRequests jika kamu ingin pakai DB/memori
  this.pendingRequests = this.pendingRequests || [];
  this.pendingRequests.push({
    subdomain,
    userId: chatId,
    messageId: adminNotif.result.message_id,
  });

  return new Response('OK', { status: 200 });
}

// Approve request
if (text.startsWith('/approve ')) {
  if (chatId !== this.ownerId) return new Response('OK', { status: 200 });

  const [ , subdomain, targetUserId ] = text.split(' ');
  const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });

  let status = 500;
  try {
    status = await this.globalBot.addSubdomain(subdomain);
  } catch (err) {
    console.error('❌ addSubdomain() error:', err);
  }

  if (status === 200) {
    await this.sendMessage(targetUserId,
`✅ Domain Request *APPROVED*

🔗 Domain: ${fullDomain}
✅ Status: Disetujui oleh admin
📅 Time: ${timestamp}

💡 Silakan gunakan domain sesuai kebutuhan.` );
  } else {
    await this.sendMessage(chatId, `❌ Gagal approve *${subdomain}*, status: ${status}`);
  }

  return new Response('OK', { status: 200 });
}

// Reject request
if (text.startsWith('/reject ')) {
  if (chatId !== this.ownerId) return new Response('OK', { status: 200 });

  const [ , subdomain, targetUserId ] = text.split(' ');
  const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });

  await this.sendMessage(targetUserId,
`❌ Domain Request *REJECTED*

🔗 Domain: ${fullDomain}
❌ Status: Ditolak oleh admin
📅 Time: ${timestamp}

💡 Saran:
- Pastikan domain yang direquest sesuai dengan kebijakan
- Hubungi admin jika ada pertanyaan
- Anda bisa request domain lain yang sesuai.`);

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

  async deleteMessage(chatId, messageId) {
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
}
