import { checkProxyIP } from './checkip.js';

export default class TelegramBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    if (!update.message) return { status: 200, body: 'OK' };
    if (update.message.from?.is_bot) return { status: 200, body: 'OK' };

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || '';

    const inputs = text.split(/[\s\n]+/).filter(Boolean);
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    // Pisah input valid dan tidak valid
    const validInputs = inputs.filter(input => ipPortPattern.test(input));
    const invalidInputs = inputs.filter(input => !ipPortPattern.test(input));

    // Kirim pesan kesalahan untuk input tidak valid
    for (const invalid of invalidInputs) {
      await this.sendMessage(
        chatId,
        `Format salah: ${invalid}\nFormat: IP atau IP:PORT (port default 443 jika tidak disertakan)`
      );
    }

    if (validInputs.length === 0) {
      return { status: 200, body: 'OK' };
    }

    if (validInputs.length === 1) {
      const input = validInputs[0];
      console.log('Memulai proses untuk:', input);

      let loadingMsg;
      try {
        loadingMsg = await this.sendMessage(chatId, `⏳ Memproses IP: ${input} ...`);
        console.log('Loading message sent:', loadingMsg);
      } catch (e) {
        console.error('Error kirim pesan loading:', e);
      }

      let result;
      try {
        result = await checkProxyIP(input);
        console.log('Hasil checkProxyIP:', result);
      } catch (e) {
        console.error('Error cek IP:', e);
      }

      if (loadingMsg?.result?.message_id) {
        try {
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          console.log('Pesan loading dihapus');
        } catch (e) {
          console.error('Gagal hapus pesan loading:', e);
        }
      }

      if (result) {
        if (result.status === 'ACTIVE') {
          await this.sendMessage(chatId, result.configText);
        } else if (result.status === 'ERROR') {
          await this.sendMessage(chatId, `❌ Error cek IP: ${input}`);
        } else {
          await this.sendMessage(chatId, `⚠️ Proxy tidak aktif atau tidak valid: ${input}`);
        }
      }

    } else {
      // Jika lebih dari satu input, proses satu per satu seperti sebelumnya
      for (const input of validInputs) {
        const loadingMsg = await this.sendMessage(chatId, `⏳ Memproses IP: ${input} ...`);
        const result = await checkProxyIP(input);
        await this.deleteMessage(chatId, loadingMsg.result.message_id);

        if (result.status === 'ACTIVE') {
          await this.sendMessage(chatId, result.configText);
        } else if (result.status === 'ERROR') {
          await this.sendMessage(chatId, `❌ Error cek IP: ${input}`);
        } else {
          await this.sendMessage(chatId, `⚠️ Proxy tidak aktif atau tidak valid: ${input}`);
        }
      }
    }

    return { status: 200, body: 'OK' };
  }

  async sendMessage(chatId, text) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
  }
}
