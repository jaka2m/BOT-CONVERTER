import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      // Gunakan OWNER_ID dari env agar konsisten dan mudah konfigurasi
      const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, undefined, Number(env.OWNER_ID));

      return bot.handleUpdate(update);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
};
