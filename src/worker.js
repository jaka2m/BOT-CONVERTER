import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5 } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId);
      const bot5 = new Bot5(token, ownerId, {
        apiUrl: 'https://api.telegram.org',
        accountID: env.ACCOUNT_ID,
        zoneID: env.ZONE_ID,
        apiKey: env.API_KEY,
        apiEmail: env.API_EMAIL,
        serviceName: env.SERVICE_NAME || 'siren',
        rootDomain: env.ROOT_DOMAIN || '',
      });

      await Promise.all([
        bot1.handleUpdate(update),
        bot2.handleUpdate(update),
        bot3.handleUpdate(update),
        bot4.handleUpdate(update),
        bot5.handleUpdate(update),
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
