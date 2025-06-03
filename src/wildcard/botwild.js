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

    // Contoh: pemilik bot ID
const ownerId = this.ownerId; // misal ownerId disimpan di this.ownerId

// Cek perintah add
if (text.startsWith('/add ')) {
  const subdomain = text.split(' ')[1]?.trim();
  if (!subdomain) return new Response('OK', { status: 200 });

  const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
  const requester = `@${username || 'unknown'}`; // username user pengirim (pastikan kamu dapat username dari update)
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (chatId === ownerId) {
    // Pemilik bot langsung proses add tanpa harus approval
    let status = 500;
    try {
      status = await this.globalBot.addSubdomain(subdomain);
    } catch (e) {
      console.error('Error addSubdomain owner:', e);
    }
    if (status === 200) {
      await this.sendMessage(chatId, `✅ Domain *${fullDomain}* berhasil ditambahkan oleh pemilik bot.`, { parse_mode: 'Markdown' });
    } else {
      await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${fullDomain}*, status: \`${status}\``, { parse_mode: 'Markdown' });
    }
    return new Response('OK', { status: 200 });
  }

  // Kalau user biasa, kirim pesan request berhasil dikirim, dan simpan request untuk approval admin
  await this.sendMessage(chatId,
    `✅ Request domain berhasil dikirim!\n\n` +
    `🔗 Domain: ${fullDomain}\n` +
    `👤 Requester: ${requester}\n` +
    `📅 Time: ${now}\n\n` +
    `⏳ Status: Menunggu approval admin\n` +
    `📬 Admin akan dinotifikasi untuk approve/reject request Anda\n\n` +
    `💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.`,
    { parse_mode: 'Markdown' }
  );

  // Kirim notifikasi ke admin / owner agar approve/reject request ini
  // Bisa diimplementasikan sesuai sistem kamu, contoh:
  // await this.sendMessage(ownerId,
  //   `📥 Domain request baru:\n` +
  //   `🔗 Domain: ${fullDomain}\n` +
  //   `👤 Requester: ${requester}\n` +
  //   `📅 Time: ${now}\n\n` +
  //   `Gunakan perintah /approve ${subdomain} atau /reject ${subdomain} untuk memproses.`);

  // Simpan data request ke database atau memori untuk nanti admin approve/reject
  await this.savePendingRequest({
    domain: fullDomain,
    subdomain,
    requesterId: chatId,
    requesterUsername: username,
    time: now,
    status: 'pending',
  });

  return new Response('OK', { status: 200 });
}

// Command untuk admin approve
if (text.startsWith('/approve ')) {
  if (chatId !== ownerId) {
    await this.sendMessage(chatId, '⛔ Anda bukan admin.');
    return new Response('OK', { status: 200 });
  }

  const subdomain = text.split(' ')[1]?.trim();
  if (!subdomain) return new Response('OK', { status: 200 });

  // Cari request yang pending
  const request = await this.getPendingRequest(subdomain);
  if (!request) {
    await this.sendMessage(chatId, `⚠️ Request domain ${subdomain} tidak ditemukan atau sudah diproses.`);
    return new Response('OK', { status: 200 });
  }

  // Proses add subdomain
  let status = 500;
  try {
    status = await this.globalBot.addSubdomain(subdomain);
  } catch (e) {
    console.error('Error addSubdomain admin:', e);
  }

  if (status === 200) {
    // Update status request jadi approved
    await this.updateRequestStatus(subdomain, 'approved');

    // Kirim pesan ke requester
    await this.sendMessage(request.requesterId,
      `✅ Domain Request APPROVED!\n\n` +
      `🔗 Domain: ${request.domain}\n` +
      `✅ Status: Disetujui oleh admin\n` +
      `📅 Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      { parse_mode: 'Markdown' }
    );

    // Info ke admin
    await this.sendMessage(chatId, `✅ Domain ${request.domain} telah disetujui dan ditambahkan.`);
  } else {
    await this.sendMessage(chatId, `❌ Gagal menambahkan domain ${request.domain}, status: ${status}`);
  }

  return new Response('OK', { status: 200 });
}

// Command untuk admin reject
if (text.startsWith('/reject ')) {
  if (chatId !== ownerId) {
    await this.sendMessage(chatId, '⛔ Anda bukan admin.');
    return new Response('OK', { status: 200 });
  }

  const subdomain = text.split(' ')[1]?.trim();
  if (!subdomain) return new Response('OK', { status: 200 });

  const request = await this.getPendingRequest(subdomain);
  if (!request) {
    await this.sendMessage(chatId, `⚠️ Request domain ${subdomain} tidak ditemukan atau sudah diproses.`);
    return new Response('OK', { status: 200 });
  }

  // Update status request jadi rejected
  await this.updateRequestStatus(subdomain, 'rejected');

  // Kirim pesan ke requester
  await this.sendMessage(request.requesterId,
    `❌ Domain Request REJECTED / approval\n\n` +
    `🔗 Domain: ${request.domain}\n` +
    `❌ Status: Ditolak oleh admin\n` +
    `📅 Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
    `💡 Saran:\n` +
    `- Pastikan domain yang direquest sesuai dengan kebijakan\n` +
    `- Hubungi admin jika ada pertanyaan\n` +
    `- Anda bisa request domain lain yang sesuai`,
    { parse_mode: 'Markdown' }
  );

  // Info ke admin
  await this.sendMessage(chatId, `❌ Domain ${request.domain} telah ditolak.`);

  return new Response('OK', { status: 200 });
}

    // Delete Subdomain
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
