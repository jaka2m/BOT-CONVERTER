import { addsubdomain, deletesubdomain, listSubdomains } from './wil.js';

const rootDomain = "joss.checker-ip.xyz";

export default class TelegramBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';

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
        const status = await addsubdomain(subdomain);
        if (status === 200) {
          await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${rootDomain} added successfully.`);
        } else if (status === 409) {
          await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${rootDomain} already exists.`);
        } else if (status === 530) {
          await this.sendMessage(chatId, `❌ Subdomain ${subdomain}.${rootDomain} not active or error 530.`);
        } else {
          await this.sendMessage(chatId, `❌ Failed to add subdomain ${subdomain}.${rootDomain}, status: ${status}`);
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
          await this.sendMessage(chatId, `✅ Subdomain ${subdomain}.${rootDomain} deleted successfully.`);
        } else if (status === 404) {
          await this.sendMessage(chatId, `⚠️ Subdomain ${subdomain}.${rootDomain} not found.`);
        } else {
          await this.sendMessage(chatId, `❌ Failed to delete subdomain ${subdomain}.${rootDomain}, status: ${status}`);
        }
        return new Response('OK', { status: 200 });
      }

      if (text === '/list') {
        const domains = await listSubdomains();
        if (domains.length === 0) {
          await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
        } else {
          const formattedList = domains.map((d, i) => `*${i + 1}.* \`${d}\``).join('\n');
          const content = domains.map((d) => `${d}`).join('\n');

          await this.sendMessage(chatId, `*Registered Subdomains:*\n\n${formattedList}`, {
            parse_mode: 'Markdown'
          });

          await this.sendDocument(chatId, content, 'subdomains.txt', 'text/plain');
        }
        return new Response('OK', { status: 200 });
      }

      if (text === '/worklist') {
        if (chatId !== this.ownerId) {
          await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
          return new Response('OK', { status: 200 });
        }

        const domains = await listSubdomains();
        if (domains.length === 0) {
          await this.sendMessage(chatId, '*No active subdomains found.*', { parse_mode: 'MarkdownV2' });
        } else {
          const inlineKeyboard = domains.map((d) => ([{
            text: `❌ ${d}`,
            callback_data: `delete_subdomain:${d}`
          }]));

          await this.sendMessage(chatId, '*Worklist Subdomains:*\nTap to delete ⬇️', {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          });
        }
        return new Response('OK', { status: 200 });
      }

      await this.sendMessage(chatId, '*Unknown command.* Use /add, /del, /list, or /worklist.', {
        parse_mode: 'MarkdownV2'
      });
      return new Response('OK', { status: 200 });
    }

    // Handle tombol inline hapus
    if (update.callback_query) {
      const { data, message } = update.callback_query;
      const chatId = message.chat.id;

      if (data.startsWith('delete_subdomain:')) {
        const sub = data.split(':')[1];
        const status = await deletesubdomain(sub);
        if (status === 200) {
          await this.editMessageText(chatId, message.message_id, `✅ Subdomain \`${sub}\` deleted successfully.`, {
            parse_mode: 'Markdown'
          });
        } else {
          await this.editMessageText(chatId, message.message_id, `❌ Failed to delete subdomain \`${sub}\`.`, {
            parse_mode: 'Markdown'
          });
        }
      }
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      ...extra
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

  async editMessageText(chatId, messageId, text, extra = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...extra
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
