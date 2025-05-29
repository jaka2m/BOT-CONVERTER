import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const bot1 = new Bot1(env.TELEGRAM_BOT_TOKEN);
      const bot2 = new Bot2(env.TELEGRAM_BOT_TOKEN);

      // Jalankan handleUpdate di kedua bot secara berurutan
      // Biasanya cuma butuh return salah satu response (misalnya dari bot1)
      await bot1.handleUpdate(update);
      await bot2.handleUpdate(update);

      // Kembalikan response 200 OK
      return new Response('OK', { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
