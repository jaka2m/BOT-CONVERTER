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

  // Broadcast ke semua user kecuali yang di exclude
  async broadcastToUsers(excludeIds = [], message, options = {}) {
    const users = await this.globalBot.getAllUsers(); // Harus return array user dengan id/chatId
    for (const user of users) {
      const userId = user.id || user.chatId;
      if (!excludeIds.includes(userId)) {
        try {
          await this.sendMessage(userId, message, options);
        } catch (err) {
          console.warn(`Gagal kirim ke user ${userId}:`, err);
        }
      }
    }
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const fromUser = update.message.from;
    const username = fromUser.username || fromUser.first_name || 'Unknown';
    const text = update.message.text || '';

    const isOwner = chatId === this.ownerId;

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan subdomain setelah /add.');
        return new Response('OK', { status: 200 });
      }

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      if (isOwner) {
        // Owner langsung proses tanpa pesan request
        let status = 500;
        try {
          status = await this.globalBot.addSubdomain(subdomain);
        } catch (e) {
          console.error('addSubdomain error:', e);
        }

        if (status === 200) {
          await this.sendMessage(chatId, `✅ Domain *${fullDomain}* berhasil ditambahkan oleh owner.`, { parse_mode: 'Markdown' });
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${fullDomain}*, status: ${status}`, { parse_mode: 'Markdown' });
        }
        return new Response('OK', { status: 200 });
      }

      // Cek request pending user
      try {
        const existingRequest = await this.globalBot.findPendingRequest(subdomain, chatId);
        if (existingRequest) {
          await this.sendMessage(chatId, `⚠️ Anda sudah mengirim request untuk domain *${fullDomain}* dan masih menunggu approval.`, { parse_mode: 'Markdown' });
          return new Response('OK', { status: 200 });
        }
      } catch (err) {
        console.error('Error checking existing request:', err);
      }

      // Simpan request ke DB
      try {
        await this.globalBot.saveDomainRequest({
          domain: fullDomain,
          requesterId: chatId,
          requesterUsername: username,
          requestTime: now,
          status: 'pending',
        });
      } catch (err) {
        console.error('Error saving domain request:', err);
      }

      // Kirim notif ke requester
      const msgRequest =
`✅ Request domain berhasil dikirim!

🔗 Domain: ${fullDomain}
👤 Requester: @${username}
📅 Time: ${now}

⏳ Status: Menunggu approval admin
📬 Admin akan dinotifikasi untuk approve/reject request Anda

💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.`;

      await this.sendMessage(chatId, msgRequest);

      // Kirim notif ke admin
      const msgAdmin =
`📩 *New Domain Request*

🔗 Domain: ${fullDomain}
👤 Requester: @${username}
📅 Time: ${now}

Untuk approve, ketik:
/approve ${subdomain}

Untuk reject, ketik:
/reject ${subdomain}`;

      await this.sendMessage(this.ownerId, msgAdmin, { parse_mode: 'Markdown' });

      return new Response('OK', { status: 200 });
    }

    // Command /approve
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Hanya admin yang bisa approve.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      const request = await this.globalBot.getDomainRequest(fullDomain);
      if (!request) {
        await this.sendMessage(chatId, `⚠️ Tidak ditemukan permintaan untuk *${fullDomain}*.`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      // Tambahkan subdomain
      let status = await this.globalBot.addSubdomain(subdomain);

      if (status === 200) {
        await this.globalBot.markRequestApproved(fullDomain);

        // Notifikasi requester
        await this.sendMessage(request.requesterId,
          `✅ Permintaan domain *${fullDomain}* Anda telah *disetujui* oleh admin. Silakan gunakan sekarang.`,
          { parse_mode: 'Markdown' });

        // Notifikasi user lain (kecuali owner dan requester)
        await this.broadcastToUsers([this.ownerId, request.requesterId],
          `📣 Domain baru telah disetujui: *${fullDomain}*`,
          { parse_mode: 'Markdown' });

        await this.sendMessage(chatId, `✅ Domain *${fullDomain}* berhasil di-approve.`, { parse_mode: 'Markdown' });
      } else {
        await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${fullDomain}* (status ${status}).`, { parse_mode: 'Markdown' });
      }
      return new Response('OK', { status: 200 });
    }

    // Command /reject
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Hanya admin yang bisa reject.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain) return new Response('OK', { status: 200 });

      const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
      const request = await this.globalBot.getDomainRequest(fullDomain);
      if (!request) {
        await this.sendMessage(chatId, `⚠️ Tidak ditemukan permintaan untuk *${fullDomain}*.`, { parse_mode: 'Markdown' });
        return new Response('OK', { status: 200 });
      }

      await this.globalBot.markRequestRejected(fullDomain);

      // Notifikasi requester
      await this.sendMessage(request.requesterId,
        `❌ Permintaan domain *${fullDomain}* Anda telah *ditolak* oleh admin.`,
        { parse_mode: 'Markdown' });

      // Notifikasi user lain (kecuali owner dan requester)
      await this.broadcastToUsers([this.ownerId, request.requesterId],
        `⚠️ Domain *${fullDomain}* ditolak oleh admin.`,
        { parse_mode: 'Markdown' });

      await this.sendMessage(chatId, `✅ Permintaan *${fullDomain}* ditolak dan dihapus.`, { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    // Command /del
    if (text.startsWith('/del ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      const subdomain = text.split(' ')[1]?.trim();
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
          await this.sendMessage(chatId, `❗ Domain ${domainMsg} tidak ditemukan.`, { parse_mode: 'MarkdownV2' });
          break;
        default:
          await this.sendMessage(chatId, `❗ Gagal menghapus ${domainMsg} (status: ${status}).`, { parse_mode: 'MarkdownV2' });
          break;
      }
      return new Response('OK', { status: 200 });
    }

    // /start or unknown commands
    if (text === '/start' || text === '/help') {
      const helpText =
`👋 Halo, ini adalah bot wildcard domain.

📌 Perintah:
- /add [subdomain] : Request domain wildcard
- /del [subdomain] : Hapus domain (admin saja)
- /approve [subdomain] : Approve request (admin)
- /reject [subdomain] : Tolak request (admin)

Kontak admin jika ada pertanyaan.`;

      await this.sendMessage(chatId, helpText);
      return new Response('OK', { status: 200 });
    }

    // Kalau pesan lain, abaikan
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const params = {
      chat_id: chatId,
      text,
      ...options,
    };

    const searchParams = new URLSearchParams(params);
    const url = `${this.apiUrl}/bot${this.token}/sendMessage?${searchParams.toString()}`;

    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`Telegram API error: ${resp.status} ${await resp.text()}`);
    }
    return resp.json();
  }
}
