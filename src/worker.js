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

      // Obfuscated encoded API key
      const parts1 = ['NWZhZTlm', 'Y2I5YzE5', 'M2NlNjVk', 'ZTRiNTc2', 'ODlhOTQ5', 'MzhiNzA4ZQ=='];
      const api = parts1.join('');
      const apiKey = atob(api);
      
      const parts2 = ['am9zcy5j', 'aGVja2VyLWlw', 'Lnh5eg=='];
      const root = parts2.join('');
      const rootDomain = atob(root);
      
      const parts3 = ['ZTk5MzBk', 'NWNhNjgzYjA0', 'NjFmNzM0NzcwNTBmZWUwYzc='];
      const account = parts3.join('');
      const accountID = atob(account);
      
      const parts4 = ['ODA0MjNl', 'NzU0N2QyZmE4', 'NWUxMzc5NmExZjQxZGVjZWQ='];
      const zone = parts4.join('');
      const zoneID = atob(zone);
      
      const parts5 = ['YW1iZWJhbG9uZw==', 'QGdtYWlsLmNvbQ=='];
      const email = parts5.join('');
      const apiEmail = atob(email);
      
      const parts6 = ['c2ly', 'ZW4='];
      const name = parts6.join('');
      const serviceName = atob(name);

      const globalBot = new KonstantaGlobalbot({ apiKey, rootDomain, accountID, zoneID, apiEmail, serviceName });

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
