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
    const text = update.message.text || '';
    const env = {
      API_KEY: this.apiKey,
      API_EMAIL: this.apiEmail,
      ROOT_DOMAIN: this.rootDomain,
      SERVICE_NAME: this.serviceName
    };

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 'Welcome! Use /add <subdomain> to add, /del <subdomain> to delete, /list to list subdomains.');
      return new Response('OK', { status: 200 });
    }

    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }
      const status = await addsubdomain(subdomain, env);
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${this.rootDomain} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${this.rootDomain} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `❌ Subdomain ${subdomain}.${this.rootDomain} not active or returned 530.`);
      } else {
        await this.sendMessage(chatId, `❌ Failed to add subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }
      const status = await deletesubdomain(subdomain, env);
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${this.rootDomain} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${this.rootDomain} not found.`);
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      const domains = await listSubdomains(env);
      if (domains.length === 0) {
        await this.sendMessage(chatId, '📭 No subdomains registered yet.');
      } else {
        await this.sendMessage(chatId, `📋 Registered subdomains:\n${domains.join('\n')}`);
      }
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, '❓ Unknown command. Use /add, /del, or /list.');
    return new Response('OK', { status: 200 });
  }

  // sendMessage and sendDocument unchanged
}
