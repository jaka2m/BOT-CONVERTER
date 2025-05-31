import { addsubdomain, deletesubdomain } from './wildcard.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    if (text.startsWith('/start')) {
      await this.sendMessage(chatId, 'Halo! Gunakan perintah:\n/add <subdomain> untuk menambah subdomain\n/del <subdomain> untuk menghapus subdomain');
    } else if (text.startsWith('/add ')) {
      const subdomain = text.slice(5).trim();
      if (!subdomain) {
        await this.sendMessage(chatId, 'Gunakan: /add <subdomain>');
      } else {
        await this.handleAdd(chatId, subdomain);
      }
    } else if (text.startsWith('/del ')) {
      const subdomain = text.slice(5).trim();
      if (!subdomain) {
        await this.sendMessage(chatId, 'Gunakan: /del <subdomain>');
      } else {
        await this.handleDelete(chatId, subdomain);
      }
    } else {
      await this.sendMessage(chatId, 'Perintah tidak dikenal. Gunakan /start untuk daftar perintah.');
    }

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

  async handleAdd(chatId, subdomain) {
    await this.sendMessage(chatId, `Menambahkan subdomain: ${subdomain}...`);
    try {
      const status = await addsubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain} berhasil ditambahkan.`);
      } else if (status === 409) {
        await this.sendMessage(chatId, `Subdomain ${subdomain} sudah terdaftar.`);
      } else if (status === 400) {
        await this.sendMessage(chatId, `Format subdomain salah atau tidak valid.`);
      } else if (status === 530) {
        await this.sendMessage(chatId, `Cloudflare error 530: gateway error.`);
      } else {
        await this.sendMessage(chatId, `Gagal menambahkan subdomain, status: ${status}`);
      }
    } catch (e) {
      await this.sendMessage(chatId, `Terjadi kesalahan: ${e.message}`);
    }
  }

  async handleDelete(chatId, subdomain) {
    await this.sendMessage(chatId, `Menghapus subdomain: ${subdomain}...`);
    try {
      const status = await deletesubdomain(subdomain);
      if (status === 200) {
        await this.sendMessage(chatId, `Subdomain ${subdomain} berhasil dihapus.`);
      } else {
        await this.sendMessage(chatId, `Gagal menghapus subdomain, status: ${status}`);
      }
    } catch (e) {
      await this.sendMessage(chatId, `Terjadi kesalahan: ${e.message}`);
    }
  }
}
