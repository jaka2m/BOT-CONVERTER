import TelegramBot1 from './bot1.js';
import TelegramBot2 from './bot2.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    try {
      const update = await request.json();

      if (url.pathname === '/bot1') {
        const bot1 = new TelegramBot1(env.TELEGRAM_BOT_TOKEN1);
        return bot1.handleUpdate(update);
      } else if (url.pathname === '/bot2') {
        const bot2 = new TelegramBot2(env.TELEGRAM_BOT_TOKEN2);
        return bot2.handleUpdate(update);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
