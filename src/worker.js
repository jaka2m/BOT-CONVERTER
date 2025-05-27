import TelegramBot from './bot.js';
import TelegramBot2 from './bot2.js';

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        // Inisialisasi dua bot dengan token masing-masing
        const bot1 = new TelegramBot(env.TELEGRAM_BOT_TOKEN1);
        const bot2 = new TelegramBot2(env.TELEGRAM_BOT_TOKEN2);

        // Contoh routing sederhana berdasarkan chat id
        const chatId = update.message?.chat?.id || 0;

        if (chatId % 2 === 0) {
          // Kirim ke bot1
          return bot1.handleUpdate(update);
        } else {
          // Kirim ke bot2
          return bot2.handleUpdate(update);
        }
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
