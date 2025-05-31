import { addsubdomain, deletesubdomain, listSubdomains } from './wildcard.js';

export default class TelegramBot {
  constructor(token, apiUrl, ownerId, env) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.env = env;  // simpan env di sini
  }

  async handleUpdate(update) {
    // ...

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }
      const status = await addsubdomain(subdomain, this.env);  // pake this.env
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.env.ROOT_DOMAIN} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.env.ROOT_DOMAIN} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.env.ROOT_DOMAIN} not active or error 530.`);
      } else {
        await this.sendMessage(chatId, `Failed to add subdomain ${subdomain}.${this.env.ROOT_DOMAIN}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }
      const status = await deletesubdomain(subdomain, this.env);  // pake this.env
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.env.ROOT_DOMAIN} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${this.env.ROOT_DOMAIN} not found.`);
      } else {
        await this.sendMessage(chatId, `Failed to delete subdomain ${subdomain}.${this.env.ROOT_DOMAIN}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      const domains = await listSubdomains(this.env);  // pake this.env
      if (domains.length === 0) {
        await this.sendMessage(chatId, 'No subdomains registered yet.');
      } else {
        await this.sendMessage(chatId, `Registered subdomains:\n${domains.join('\n')}`);
      }
      return new Response('OK', { status: 200 });
    }

    // ...
  }

  // ... (method sendMessage, sendDocument tetap sama)
}
