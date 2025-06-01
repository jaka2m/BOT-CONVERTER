import { isAdmin, readWildcards, writeWildcards } from './itil.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const text = update.message.text || '';

    if (!isAdmin(userId)) {
      await this.sendMessage(chatId, '⛔ Kamu bukan pemilik bot!');
      return;
    }

    if (text.startsWith('/add ')) {
      const newEntry = text.substring(5).trim();
      const list = await readWildcards();
      if (list.includes(newEntry)) {
        await this.sendMessage(chatId, '❗ Sudah ada.');
      } else {
        list.push(newEntry);
        await writeWildcards(list);
        await this.sendMessage(chatId, '✅ Ditambahkan.');
      }
    } else if (text.startsWith('/del ')) {
      const delEntry = text.substring(5).trim();
      let list = await readWildcards();
      const originalLength = list.length;
      list = list.filter(e => e !== delEntry);
      if (list.length === originalLength) {
        await this.sendMessage(chatId, '❗ Tidak ditemukan.');
      } else {
        await writeWildcards(list);
        await this.sendMessage(chatId, '✅ Dihapus.');
      }
    } else if (text === '/list') {
      const list = await readWildcards();
      const msg = list.length ? list.join('\n') : '📭 List kosong.';
      await this.sendMessage(chatId, msg);
    } else {
      await this.sendMessage(chatId, '📌 Perintah:\n/add domain.com\n/del domain.com\n/list');
    }
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    return res.json();
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());

    const res = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    return res.json();
  }
}
