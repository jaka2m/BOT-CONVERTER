import { addsubdomain, deletesubdomain, listSubdomains } from './wildcard.js';

export default class TelegramBot {
  constructor(token, ownerId, rootDomain) {
    this.token = token;
    this.ownerId = ownerId;
    this.rootDomain = rootDomain;
    this.apiUrl = 'https://api.telegram.org';
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 
        'Welcome!\nCommands:\n' +
        '/add <subdomain> - Add subdomain (owner only)\n' +
        '/del <subdomain> - Delete subdomain (owner only)\n' +
        '/list - List subdomains'
      );
      return new Response('OK', { status: 200 });
    }

    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId.toString() !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }
      const status = await addsubdomain(subdomain, this.rootDomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.rootDomain} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.rootDomain} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.rootDomain} not active or error 530.`);
      } else {
        await this.sendMessage(chatId, `Failed to add subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }
      const status = await deletesubdomain(subdomain, this.rootDomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.rootDomain} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.rootDomain} not found.`);
      } else {
        await this.sendMessage(chatId, `Failed to delete subdomain ${subdomain}.${this.rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      const domains = await listSubdomains(this.rootDomain);
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
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });
    return response.json();
  }
}
