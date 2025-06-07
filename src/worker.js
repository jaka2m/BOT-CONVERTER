import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, KonstantaGlobalbot } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Tanpa encoding base64
      const apiKey = '028462e851772f0528310f0ba91d848850886';
      const accountID = 'd7660aa2e06f4af1d5becb80c0358522';
      const zoneID = 'd33a71c24bf9c46d634f861e588ab887';
      const apiEmail = 'desalekong24@gmail.com';
      const serviceName = 'siren';
      const rootDomain = 'krikkrik.tech';

      const globalBot = new KonstantaGlobalbot({
        apiKey,
        accountID,
        zoneID,
        apiEmail,
        serviceName,
        rootDomain,
      });

      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot5 = new Bot5(token, 'https://api.telegram.org', ownerId, globalBot);
      
      await Promise.all([
        bot1.handleUpdate(update),
        bot2.handleUpdate(update),
        bot3.handleUpdate(update),
        bot4.handleUpdate(update),
        bot5.handleUpdate(update),
      ]);

      return new Response('OK', { status: 200 });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
