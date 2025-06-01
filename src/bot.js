import { addsubdomain, deletesubdomain, listSubdomains } from './wil.js';

export default class TelegramBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
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

    // ⛔ Batasi /add dan /del hanya untuk owner
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
      const status = await addsubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${rootDomain} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${rootDomain} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${rootDomain} not active or error 530.`);
      } else {
        await this.sendMessage(chatId, `Failed to add subdomain ${subdomain}.${rootDomain}, status: ${status}`);
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
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${rootDomain} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `Subdomain ${subdomain}.${rootDomain} not found.`);
      } else {
        await this.sendMessage(chatId, `Failed to delete subdomain ${subdomain}.${rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
  const domains = await listSubdomains();
  if (domains.length === 0) {
    await this.sendMessage(chatId, '*No subdomains registered yet.*', {
      parse_mode: 'Markdown'
    });
  } else {
    const formattedList = domains.map((d, i) => `*${i + 1}.* \`${d}\``).join('\n');
    await this.sendMessage(chatId, `*Registered Subdomains:*\n\n${formattedList}`, {
      parse_mode: 'Markdown'
    });
  }
  return new Response('OK', { status: 200 });
}

await this.sendMessage(chatId, '*Unknown command.* Use `/add`, `/del`, or `/list`.', {
  parse_mode: 'Markdown'
});
return new Response('OK', { status: 200 });
}

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`, {
        method: 'POST',
        body: formData
      }
    );

    return response.json();
  }
}

const rootDomain = "joss.checker-ip.xyz";
