import TelegramBot from './bot.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        // Inisialisasi bot dengan token dan ownerId
        const bot = new TelegramBot(
          env.TELEGRAM_BOT_TOKEN,          // Bot token dari environment
          undefined,                       // Tidak menggunakan secret token
          'joss.checker-ip.xyz',           // Base URL (misal untuk webhook atau identitas bot)
          1467883032                       // Telegram user ID dari owner
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
