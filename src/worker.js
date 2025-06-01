import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        // Buat instance TelegramBot dengan variabel dari env
        const bot = new TelegramBot(
          env.TELEGRAM_BOT_TOKEN,  // kalau ada, kalau tidak bisa kosongkan atau tambahkan di wrangler.toml
          undefined,               // apiUrl, default https://api.telegram.org
          env.rootDomain,
          env.ownerId
        );

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
    return new Response('Method not allowed', { status: 405 });
  }
};
