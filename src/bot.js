import { addsubdomain, deletesubdomain, listSubdomains } from './wildcard.js';

export default class TelegramBot {
  constructor(token, apiUrl, ownerId, ROOT_DOMAIN, API_KEY, API_EMAIL, SERVICE_NAME) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.rootDomain = ROOT_DOMAIN;
    this.apiKey = API_KEY;
    this.apiEmail = API_EMAIL;
    this.serviceName = SERVICE_NAME;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, '👋 Welcome! Use:\n\n/add <subdomain> – to add\n/del <subdomain> – to delete\n/list – to list all subdomains');
      return new Response('OK', { status: 200 });
    }

    // 🔒 Only owner can add/delete
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/add ')) {
      const [, subdomain] = text.split(/\s+/);
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }

      const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
      if (!isValid) {
        await this.sendMessage(chatId, '❌ Invalid subdomain. Only lowercase letters, numbers, and dashes allowed.');
        return new Response('OK', { status: 200 });
      }

      try {
        const status = await addsubdomain(subdomain, this.apiKey, this.apiEmail, this.serviceName, this.rootDomain);
        if (status === 200) {
          await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${this.rootDomain} added successfully.`);
        } else if (status === 409) {
          await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${this.rootDomain} already exists.`);
        } else if (status === 530) {
          await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${this.rootDomain} not active or error 530.`);
        } else {
          await this.sendMessage(chatId, `❌ Failed to add subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
        }
      } catch (err) {
        await this.sendMessage(chatId, `❌ Error adding subdomain: ${err.message}`);
      }

      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const [, subdomain] = text.split(/\s+/);
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }

      try {
        const status = await deletesubdomain(subdomain, this.apiKey, this.apiEmail, this.serviceName, this.rootDomain);
        if (status === 200) {
          await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${this.rootDomain} deleted successfully.`);
        } else if (status === 404) {
          await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${this.rootDomain} not found.`);
        } else {
          await this.sendMessage(chatId, `❌ Failed to delete subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
        }
      } catch (err) {
        await this.sendMessage(chatId, `❌ Error deleting subdomain: ${err.message}`);
      }

      return new Response('OK', { status: 200 });
    }

    if (text === '/list') {
      try {
        const domains = await listSubdomains(this.apiKey, this.apiEmail, this.serviceName, this.rootDomain);
        if (!domains || domains.length === 0) {
          await this.sendMessage(chatId, '📭 No subdomains registered yet.');
        } else {
          const list = domains.map(d => `- ${d}`).join('\n');
          await this.sendMessage(chatId, `📋 Registered subdomains:\n${list}`);
        }
      } catch (err) {
        await this.sendMessage(chatId, `❌ Error listing subdomains: ${err.message}`);
      }

      return new Response('OK', { status: 200 });
    }

    // Default: unknown command
    await this.sendMessage(chatId, '❓ Unknown command. Use /add, /del, or /list.');
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    return response.json();
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
