import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        // Ambil ownerId dari environment variable dan parse ke integer
        const ownerId = parseInt(env.BOT_OWNER_ID, 10);

        // Kirim ownerId ke TelegramBot constructor
        const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, 'https://api.telegram.org', ownerId);

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
