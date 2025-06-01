import { addsubdomain, deletesubdomain, listSubdomains } from './wil.js';

const rootDomain = "joss.checker-ip.xyz";

export default class TelegramBot {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 'Welcome! Use /add <subdomain> to add, /del <subdomain> to delete, /list to list subdomains, or /worklist to manage.');
      return new Response('OK', { status: 200 });
    }

    // Batasi add/del hanya owner
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

    if (text === '/worklist') {
      await this.sendWorklist(chatId);
      return new Response('OK', { status: 200 });
    }

    await this.sendMessage(chatId, 'Unknown command. Use /add, /del, /list, or /worklist.');
    return new Response('OK', { status: 200 });
  }

  // Fungsi untuk kirim daftar + file + inline keyboard delete
  async sendWorklist(chatId) {
    const domains = await listSubdomains();
    if (domains.length === 0) {
      await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      return;
    }

    // Kirim file txt daftar subdomain
    const content = domains.join('\n');
    await this.sendDocument(chatId, content, 'subdomains.txt', 'text/plain');

    // Buat teks dan inline keyboard tombol delete
    const textLines = domains.map((d, i) => `${i + 1}. ${escapeMarkdownV2(d)}`);
    const text = `*Subdomains List:*\n${textLines.join('\n')}`;

    // Inline keyboard per subdomain untuk tombol delete
    const inline_keyboard = domains.map(d => [
      {
        text: `Delete ${d}`,
        callback_data: `delete_${d}`
      }
    ]);

    await this.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard }
    });
  }

  // Handler callback query (tombol)
  async handleCallbackQuery(callbackQuery) {
    const { id, data, message } = callbackQuery;
    const chatId = message.chat.id;

    if (data.startsWith('delete_')) {
      const subdomain = data.substring('delete_'.length);

      // Batasi hanya owner bisa hapus via tombol
      if (chatId !== this.ownerId) {
        await this.answerCallbackQuery(id, '⛔ You are not authorized to delete.');
        return new Response('OK', { status: 200 });
      }

      const status = await deletesubdomain(subdomain);

      if (status === 200) {
        await this.answerCallbackQuery(id, `Subdomain ${subdomain}.${rootDomain} deleted.`);

        // Update pesan daftar (hapus subdomain yang sudah dihapus)
        const domains = await listSubdomains();
        if (domains.length === 0) {
          await this.editMessageText(chatId, message.message_id, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
          return new Response('OK', { status: 200 });
        }

        const textLines = domains.map((d, i) => `${i + 1}. ${escapeMarkdownV2(d)}`);
        const text = `*Subdomains List:*\n${textLines.join('\n')}`;

        const inline_keyboard = domains.map(d => [
          {
            text: `Delete ${d}`,
            callback_data: `delete_${d}`
          }
        ]);

        await this.editMessageText(chatId, message.message_id, text, {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard }
        });
      } else if (status === 404) {
        await this.answerCallbackQuery(id, `Subdomain ${subdomain}.${rootDomain} not found.`);
      } else {
        await this.answerCallbackQuery(id, `Failed to delete subdomain, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    // Kalau callback lain, jawab OK saja
    await this.answerCallbackQuery(id, '');
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendDocument`,
      {
        method: 'POST',
        body: formData
      }
    );
    return response.json();
  }

  async answerCallbackQuery(callbackQueryId, text = '') {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId, text, show_alert: false };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }
}

// Escape MarkdownV2 special characters
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}
