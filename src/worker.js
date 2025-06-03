import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, KonstantaGlobalbot } from './wildcard/botwild.js';

function decode(joinedParts) {
  return atob(joinedParts.join(''));
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Obfuscate API key
      const apiKey = decode([
        'NWZhZTlm', 'Y2I5YzE5', 'M2NlNjVk',
        'ZTRiNTc2', 'ODlhOTQ5', 'MzhiNzA4ZQ==',
      ]);

      // Obfuscate other config values
      const rootDomain = decode(['am9zcy5j', 'aGVja2VyLWlw', 'Lnh5eg==']);
      const accountID = decode(['ZTk5MzBk', 'NWNhNjgzYjA0', 'NjFmNzM0NzcwNTBmZWUwYzc=']);
      const zoneID = decode(['ODA0MjNl', 'NzU0N2QyZmE4', 'NWUxMzc5NmExZjQxZGVjZWQ=']);
      const apiEmail = decode(['YW1iZWJhbG9uZw==', 'QGdtYWlsLmNvbQ==']);
      const serviceName = decode(['c2ly', 'ZW4=']);

      const globalBot = new KonstantaGlobalbot({
        apiKey,
        rootDomain,
        accountID,
        zoneID,
        apiEmail,
        serviceName,
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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
