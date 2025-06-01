const API_KEY = __STATIC_CONTENT_API_KEY || API_KEY || globalThis.API_KEY || env.API_KEY || BOT_ENV_API_KEY || process.env.API_KEY;
const ACCOUNT_ID = __STATIC_CONTENT_ACCOUNT_ID || process.env.ACCOUNT_ID;
const ZONE_ID = __STATIC_CONTENT_ZONE_ID || process.env.ZONE_ID;
const API_EMAIL = __STATIC_CONTENT_API_EMAIL || process.env.API_EMAIL;
const SERVICE_NAME = __STATIC_CONTENT_SERVICE_NAME || process.env.SERVICE_NAME;
const ROOT_DOMAIN = __STATIC_CONTENT_ROOT_DOMAIN || process.env.ROOT_DOMAIN;
const OWNER_ID = __STATIC_CONTENT_OWNER_ID || process.env.OWNER_ID;
const TELEGRAM_TOKEN = __STATIC_CONTENT_TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN;

export default class TelegramBot {
  constructor(token = TELEGRAM_TOKEN, apiUrl = 'https://api.telegram.org', ownerId = OWNER_ID) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 'Welcome! Use /add <subdomain> to add, /del <subdomain> to delete, /list to list subdomains.');
      return new Response('OK', { status: 200 });
    }

    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId.toString() !== this.ownerId.toString()) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }
      const status = await addsubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${ROOT_DOMAIN} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${ROOT_DOMAIN} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${ROOT_DOMAIN} not active or error 530.`);
      } else {
        await this.sendMessage(chatId, `Failed to add subdomain ${subdomain}.${ROOT_DOMAIN}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }
      const status = await deletesubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${ROOT_DOMAIN} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${ROOT_DOMAIN} not found.`);
      } else {
        await this.sendMessage(chatId, `Failed to delete subdomain ${subdomain}.${ROOT_DOMAIN}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      const domains = await listSubdomains();
      if (domains.length === 0) {
        await this.sendMessage(chatId, 'No subdomains registered yet.');
      } else {
        await this.sendMessage(chatId, `Registered subdomains:\n${domains.join('\n')}`);
      }
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, 'Unknown command. Use /add, /del, or /list.');
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
    return response.json();
  }
}

// Cloudflare API functions accessing environment variables directly

async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'X-Auth-Email': API_EMAIL,
    'X-Auth-Key': API_KEY,
    'Content-Type': 'application/json'
  };

  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result.filter(d => d.service === SERVICE_NAME).map(d => d.hostname);
  }
  return [];
}

export async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${ROOT_DOMAIN}`.toLowerCase();

  if (!domain.endsWith(ROOT_DOMAIN)) return 400;

  const registeredDomains = await getDomainList();
  if (registeredDomains.includes(domain)) return 409;

  try {
    // Cek apakah domain sudah aktif (cek 530)
    const testUrl = `https://${domain.replace(`.${ROOT_DOMAIN}`, '')}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: SERVICE_NAME,
    zone_id: ZONE_ID
  };

  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'X-Auth-Email': API_EMAIL,
    'X-Auth-Key': API_KEY,
    'Content-Type': 'application/json'
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

export async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${ROOT_DOMAIN}`.toLowerCase();

  const urlList = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'X-Auth-Email': API_EMAIL,
    'X-Auth-Key': API_KEY,
    'Content-Type': 'application/json'
  };

  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

export async function listSubdomains() {
  return await getDomainList();
}
