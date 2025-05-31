import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        // Gunakan env untuk semua variabel penting
        const bot = new TelegramBot(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_API_URL,
          Number(env.OWNER_ID),
          env.ROOT_DOMAIN,
          env
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
