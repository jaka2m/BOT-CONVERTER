import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5 } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const ownerId = env.OWNER_ID; // <-- di sini ambil dari env, benar

      const bot1 = new Bot1(env.TELEGRAM_BOT_TOKEN, undefined, OWNER_ID);
      const bot2 = new Bot2(env.TELEGRAM_BOT_TOKEN, undefined, OWNER_ID);
      const bot3 = new Bot3(env.TELEGRAM_BOT_TOKEN, undefined, OWNER_ID);
      const bot4 = new Bot4(env.TELEGRAM_BOT_TOKEN, undefined, OWNER_ID);
      const bot5 = new Bot5(env.TELEGRAM_BOT_TOKEN, undefined, OWNER_ID);
      
      await bot1.handleUpdate(update);
      await bot2.handleUpdate(update);
      await bot3.handleUpdate(update);
      await bot4.handleUpdate(update);
      await bot5.handleUpdate(update);

      return new Response('OK', { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
