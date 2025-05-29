import {
  handleProxyIpCommand,
  handleCountrySelection,
  handleConfigGeneration
} from './proxyip.js';

export async function proxyBot(link) {
  console.log("Bot link:", link);
}


export class TelegramProxyBot {
  constructor(token, apiUrl = 'https://api.telegram.org') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  async handleUpdate(update) {
    const message = update.message;
    const callbackQuery = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const text = message.text || '';

      if (text.startsWith('/start')) {
        await this.sendMessage(chatId, 'yes no.');
        return new Response('OK', { status: 200 });
      }

      if (text.startsWith('/proxyip')) {
        await handleProxyIpCommand(chatId, this);
        return new Response('OK', { status: 200 });
      }

      // Jika user mengirim balasan ke daftar negara untuk generate config
      if (message.reply_to_message && message.reply_to_message.text?.includes('Pilih negara')) {
        await handleConfigGeneration(chatId, text, this);
        return new Response('OK', { status: 200 });
      }
    }

    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      await handleCountrySelection(chatId, data, this);
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, replyMarkup = null) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return response.json();
  }

  async sendDocument(chatId, formData) {
    const url = `${this.apiUrl}/bot${this.token}/sendDocument`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }
}
