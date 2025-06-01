import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const update = await request.json();

    const bot = new TelegramBot(
      env.TELEGRAM_TOKEN,
      env.OWNER_ID,
      env.ROOT_DOMAIN
    );

    return await bot.handleUpdate(update);
  }
};
