export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

const rootDomain = "joss.checker-ip.xyz";


export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
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

    // 📌 Command: /add <subdomain>
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

    // 🗑️ Command: /del <subdomain>
    if (text === '/del') {
  const domains = await listSubdomains();
  if (domains.length === 0) {
    await this.sendMessage(chatId, '*Tidak ada subdomain yang terdaftar.*', {
      parse_mode: 'MarkdownV2'
    });
    return new Response('OK', { status: 200 });
  }

  const inline_keyboard = domains.map(domain => [{
    text: domain,
    callback_data: `del_select:${domain}`
  }]);

  await this.sendMessage(chatId, 'Pilih subdomain yang ingin dihapus:', {
    reply_markup: {
      inline_keyboard
    }
  });

  return new Response('OK', { status: 200 });
}

    // 📄 Command: /list
    if (text.startsWith('/list')) {
      const domains = await listSubdomains();

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
}

// 🛠️ Konfigurasi Cloudflare
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

// 🔍 Ambil semua subdomain aktif
async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result
      .filter(d => d.service === serviceName)
      .map(d => d.hostname);
  }
  return [];
}

// ➕ Tambahkan subdomain baru
export async function addsubdomain(subdomain) {
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

// ❌ Hapus subdomain
export async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  const urlList = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

// 📋 Tampilkan list subdomain
export async function listSubdomains() {
  return await getDomainList();
}

// 📦 Tangani callback dari Telegram
export async function handleUpdate(update, sendMessage) {
  if (!update.callback_query) return;

  const query = update.callback_query;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // Step 1: Pilih subdomain
  if (data.startsWith('del_select:')) {
    const subdomain = data.split(':')[1];
    await sendMessage(chatId, `Yakin ingin menghapus *${escapeMarkdownV2(subdomain)}*?`, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Ya', callback_data: `del_confirm:${subdomain}` },
            { text: '❌ Batal', callback_data: 'del_cancel' }
          ]
        ]
      }
    });
    return new Response('OK', { status: 200 });
  }

  // Step 2: Konfirmasi hapus
  if (data.startsWith('del_confirm:')) {
    const subdomain = data.split(':')[1];
    const status = await deletesubdomain(subdomain);

    if (status === 200) {
      await sendMessage(chatId, `\`\`\`Wildcard\n${escapeMarkdownV2(subdomain)} deleted successfully.\`\`\``, {
        parse_mode: 'MarkdownV2'
      });
    } else if (status === 404) {
      await sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(subdomain)}* not found.`, {
        parse_mode: 'MarkdownV2'
      });
    } else {
      await sendMessage(chatId, `❌ Failed to delete *${escapeMarkdownV2(subdomain)}*, status: \`${status}\``, {
        parse_mode: 'MarkdownV2'
      });
    }

    return new Response('OK', { status: 200 });
  }

  // Step 3: Batal
  if (data === 'del_cancel') {
    await sendMessage(chatId, '❌ Penghapusan dibatalkan.');
    return new Response('OK', { status: 200 });
  }
}

// 🔧 Escape untuk MarkdownV2
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
