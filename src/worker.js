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

      const partsApiKey = ['NWZhZTlm', 'Y2I5YzE5', 'M2NlNjVk', 'ZTRiNTc2', 'ODlhOTQ5', 'MzhiNzA4ZQ=='];
      const apiKey = atob(partsApiKey.join(''));

      const partsRootDomain = ['am9zcy5j', 'aGVja2VyLWlw', 'Lnh5eg=='];
      const partsAccountID = ['ZTk5MzBk', 'NWNhNjgzYjA0', 'NjFmNzM0NzcwNTBmZWUwYzc='];
      const partsZoneID = ['ODA0MjNl', 'NzU0N2QyZmE4', 'NWUxMzc5NmExZjQxZGVjZWQ='];
      const partsApiEmail = ['YW1iZWJhbG9uZw==', 'QGdtYWlsLmNvbQ=='];
      const partsServiceName = ['c2ly', 'ZW4='];

      const rootDomain = atob(partsRootDomain.join(''));
      const accountID = atob(partsAccountID.join(''));
      const zoneID = atob(partsZoneID.join(''));
      const apiEmail = atob(partsApiEmail.join(''));
      const serviceName = atob(partsServiceName.join(''));

      const globalBot = new KonstantaGlobalbot({
        apiKey,
        rootDomain,
        accountID,
        zoneID,
        apiEmail,
        serviceName,
      });

      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId);
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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
