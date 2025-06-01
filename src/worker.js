import TelegramBot from './bot.js';
import { TELEGRAM_BOT_TOKEN } from './itil.js';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const update = await request.json();
    await bot.handleUpdate(update);

    return new Response('OK', { status: 200 });
  }
};
