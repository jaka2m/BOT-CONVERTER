import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        const bot = new TelegramBot(
          env.TELEGRAM_BOT_TOKEN,
          'https://api.telegram.org',
          env.TELEGRAM_OWNER_ID,
          env.ROOT_DOMAIN,
          env.API_KEY,
          env.API_EMAIL,
          env.SERVICE_NAME
        );

        return bot.handleUpdate(update);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
