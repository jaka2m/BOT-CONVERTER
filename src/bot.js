import { addsubdomain, deletesubdomain, listSubdomains } from './wil.js';

const rootDomain = 'joss.checker-ip.xyz';

export default class TelegramBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    const message = update.message;
    const callback = update.callback_query;

    if (callback) {
      const chatId = callback.message.chat.id;
      const subdomain = callback.data;

      const status = await deletesubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${rootDomain} deleted successfully.`);
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete ${subdomain}.${rootDomain}, status: ${status}`);
      }

      // Jawab callback agar tombol tidak loading terus
      await this.answerCallbackQuery(callback.id);
      return new Response('OK', { status: 200 });
    }

    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat.id;
    const text = message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, `Welcome!
      
Use:
/add <subdomain> - Add subdomain
/del <subdomain> - Delete subdomain
/del - Show delete buttons
/list - List subdomains`);
      return new Response('OK', { status: 200 });
    }

    if ((text.startsWith('/add') || text.startsWith('/del')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify a subdomain. Example: /add test');
        return new Response('OK', { status: 200 });
      }

      const status = await addsubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${rootDomain} added successfully.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${rootDomain} already exists.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${rootDomain} not active or error 530.`);
      } else {
        await this.sendMessage(chatId, `❌ Failed to add ${subdomain}.${rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/del ') && text.trim().split(' ').length === 2) {
      const subdomain = text.split(' ')[1];
      const status = await deletesubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${rootDomain} deleted successfully.`);
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${rootDomain} not found.`);
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete ${subdomain}.${rootDomain}, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (text.trim() === '/del') {
      const domains = await listSubdomains();
      if (domains.length === 0) {
        await this.sendMessage(chatId, '📭 No subdomains to delete.');
      } else {
        const inlineKeyboard = domains.map(name => ([{
          text: `🗑️ ${name}`,
          callback_data: name
        }]));

        await this.sendMessage(chatId, '🗂️ Select a subdomain to delete:', {
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
      }
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/list')) {
      const domains = await listSubdomains();
      if (domains.length === 0) {
        await this.sendMessage(chatId, '📭 No subdomains registered.');
      } else {
        const content = domains.map(d => `${d}.${rootDomain}`).join('\n');
        await this.sendDocument(chatId, content, 'subdomains.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, '❓ Unknown command. Use /add, /del, or /list.');
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      ...options
    };

    if (!body.parse_mode && text.includes('```')) {
      body.parse_mode = 'Markdown';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return res.json();
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

  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
  }
}
