import { addsubdomain, deletesubdomain, listSubdomains } from './wil.js';

const rootDomain = "joss.checker-ip.xyz";

function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

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
      await this.sendMessage(
        chatId,
        '*Welcome!*\nUse `/add <subdomain>` to add,\n`/del <subdomain>` to delete,\n`/list` to list subdomains.',
        { parse_mode: 'MarkdownV2' }
      );
      return new Response('OK', { status: 200 });
    }

    // ⛔ Batasi /add dan /del hanya untuk owner
    if ((text.startsWith('/add ') || text.startsWith('/del ')) && chatId !== this.ownerId) {
      await this.sendMessage(chatId, '⛔ You are not authorized to use this command.');
      return new Response('OK', { status: 200 });
    }

    // 📌 Command: /add <subdomain>
    if (text.startsWith('/add ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to add. Example: /add test');
        return new Response('OK', { status: 200 });
      }

      const status = await addsubdomain(subdomain);
      const fullDomain = `${subdomain}.${rootDomain}`;
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain *${escapeMarkdownV2(fullDomain)}* added successfully.`, {
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
    if (text.startsWith('/del ')) {
      const subdomain = text.split(' ')[1];
      if (!subdomain) {
        await this.sendMessage(chatId, 'Please specify the subdomain to delete. Example: /del test');
        return new Response('OK', { status: 200 });
      }

      const status = await deletesubdomain(subdomain);
      const fullDomain = `${subdomain}.${rootDomain}`;
      if (status === 200) {
        await this.sendMessage(chatId, `✅ Subdomain *${escapeMarkdownV2(fullDomain)}* deleted successfully.`, {
          parse_mode: 'MarkdownV2'
        });
      } else if (status === 404) {
        await this.sendMessage(chatId, `⚠️ Subdomain *${escapeMarkdownV2(fullDomain)}* not found.`, {
          parse_mode: 'MarkdownV2'
        });
      } else {
        await this.sendMessage(chatId, `❌ Failed to delete *${escapeMarkdownV2(fullDomain)}*, status: \`${status}\``, {
          parse_mode: 'MarkdownV2'
        });
      }

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

        const textPreview = `\`\`\`\nList-Wildcard\n${formattedList}\n\`\`\``;

        await this.sendMessage(chatId, textPreview, {
          parse_mode: 'MarkdownV2'
        });

        // Kirim juga sebagai dokumen .txt
        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'subdomain-list.txt', 'text/plain');
      }

      return new Response('OK', { status: 200 });
    }

    // 🚫 Unknown command
    await this.sendMessage(
      chatId,
      '*Unknown command\\. Use* \\`/add\\`\\, \\`/del\\`\\, *or* \\`/list\\`\\.',
      { parse_mode: 'MarkdownV2' }
    );

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
