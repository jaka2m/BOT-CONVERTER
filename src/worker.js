import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot, AsuBabibot as Bot5 } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const bot1 = new Bot1(env.TELEGRAM_BOT_TOKEN, undefined, 1467883032);
      const bot2 = new Bot2(env.TELEGRAM_BOT_TOKEN, undefined, 1467883032);
      const bot3 = new Bot3(env.TELEGRAM_BOT_TOKEN, undefined, 1467883032);
      const bot4 = new Bot4(env.TELEGRAM_BOT_TOKEN, undefined, 1467883032);

      // Panggil AsuBabibot dengan 6 parameter sesuai constructor
      const bot5 = new Bot5(
        env.ROOT_DOMAIN,
        env.API_KEY,
        env.ACCOUNT_ID,
        env.ZONE_ID,
        env.API_EMAIL,
        env.SERVICE_NAME
      );

      await Promise.all([
        bot1.handleUpdate(update),
        bot2.handleUpdate(update),
        bot3.handleUpdate(update),
        bot4.handleUpdate(update),
        bot5.handleUpdate(update)
      ]);

      return new Response('OK', { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
