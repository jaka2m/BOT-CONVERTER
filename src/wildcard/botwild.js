// ========================================
// Main Telegram Wildcard Bot class
// ========================================

export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// Konstanta global
const rootDomain = "joss.checker-ip.xyz";
const apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
const accountID = "e9930d5ca683b0461f73477050fee0c7";
const zoneID = "80423e7547d2fa85e13796a1f41deced";
const apiEmail = "ambebalong@gmail.com";
const serviceName = "siren";

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'X-Auth-Email': apiEmail,
  'X-Auth-Key': apiKey,
  'Content-Type': 'application/json'
};

// Escape MarkdownV2 untuk Telegram
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

// Ambil list domain dari Cloudflare Workers
async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result.filter(d => d.service === serviceName).map(d => d.hostname);
  }
  return [];
}

// Tambah subdomain ke Cloudflare Workers
async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();
  if (!domain.endsWith(rootDomain)) return 400;

  const registeredDomains = await getDomainList();
  if (registeredDomains.includes(domain)) return 409;

  try {
    const testUrl = `https://${domain.replace(`.${rootDomain}`, '')}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: serviceName,
    zone_id: zoneID
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

// Hapus subdomain dari Cloudflare Workers
async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();
  const urlList = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;

  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `${urlList}/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

// Ambil semua subdomain terdaftar
async function listSubdomains() {
  return await getDomainList();
}

// ========================================
// Telegram Bot Handler Class
// ========================================

export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;

    // Simpan chatId user yang pernah akses bot
    this.userSet = new Set();

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  // Tangani update dari webhook
  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // Simpan user yang akses bot
    this.userSet.add(chatId);

    // Batasi command /add dan /del hanya owner
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // Handle /add
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
        status = await addsubdomain(subdomain);
      } catch (err) {
        console.error('❌ addsubdomain() error:', err);
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
        await this.sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(fullDomain)} added successfully\`\`\``, { parse_mode: 'MarkdownV2' });
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* already exists.`, { parse_mode: 'MarkdownV2' });
      } else if (status === 530) {
        await this.sendMessage(chatId, `❌ Subdomain *${escapeMarkdownV2(fullDomain)}* not active (error 530).`, { parse_mode: 'MarkdownV2' });
      } else {
        await this.sendMessage(chatId, `❌ Failed to add *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, { parse_mode: 'MarkdownV2' });
      }

      return new Response('OK', { status: 200 });
    }

    // Handle /del
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) return new Response('OK', { status: 200 });

      const status = await deletesubdomain(subdomain);
      const fullDomain = `${subdomain}.${rootDomain}`;

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
      const domains = await listSubdomains();

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

    // Handle /user
    if (text === '/user') {
      if (chatId === this.ownerId) {
        // Owner: tampilkan semua user dan total
        const usersArray = Array.from(this.userSet);
        const userListText = usersArray.map((id, i) => `${i + 1}. \`${id}\``).join('\n');
        const reply = `👥 Users who accessed the bot:\n${userListText}\n\nTotal users: *${usersArray.length}*`;
        await this.sendMessage(chatId, reply, { parse_mode: 'MarkdownV2' });
      } else {
        // User biasa: tampilkan chatId mereka saja
        await this.sendMessage(chatId, `Your chat ID: \`${chatId}\``, { parse_mode: 'MarkdownV2' });
      }
      return new Response('OK', { status: 200 });
    }

    // Handle /start and other commands here as needed
    if (text === '/start') {
      await this.sendMessage(chatId, 'Welcome! Use /add <subdomain> to add a wildcard subdomain.');
      return new Response('OK', { status: 200 });
    }

    // Jika command tidak dikenali
    await this.sendMessage(chatId, 'Unknown command. Available commands:\n/add <subdomain>\n/del <subdomain>\n/list\n/user');
    return new Response('OK', { status: 200 });
  }

  // Kirim pesan text
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options
    };
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(res => res.json());
  }

  // Hapus pesan (optional)
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // Kirim file text sebagai document (buat /list)
  async sendDocument(chatId, content, filename, mimeType) {
    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;

    // Multipart/form-data untuk kirim dokumen
    // Karena kita tidak punya akses fs di Cloudflare, gunakan form-data dengan Blob
    const formData = new FormData();
    formData.append('chat_id', chatId);
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);

    return await fetch(url, {
      method: 'POST',
      body: formData
    });
  }
}
