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

      const partsApiKey = [
        'MDI4NDYy',
        'ZTg1MTc3',
        'MmYwNTI4',
        'MzEwZjBi',
        'YTkxZDg0',
        'ODg1MDg4Ng==',
      ];
      const ngasalApiKey = partsApiKey.join('');
      const apiKey = atob(ngasalApiKey);

      const partsAccountID = [
        'ZDc2NjBh',
        'YTJlMDZm',
        'NGFmMWQ1',
        'YmVjYjgw',
        'YzAzNTg1',
        'MjI=',
      ];
      const ngasalAccountID = partsAccountID.join('');
      const accountID = atob(ngasalAccountID);

      const partsZoneID = [
        'ZDMzYTcx',
        'YzI0YmY5',
        'YzQ2ZDYz',
        'NGY4NjFl',
        'NTg4YWI4',
        'ODc=',
      ];
      const ngasalZoneID = partsZoneID.join('');
      const zoneID = atob(ngasalZoneID);

      const partsApiEmail = [
        'ZGVzYWxl',
        'a29uZzI0',
        'QGdtYWls',
        'LmNvbQ==',
      ];
      const ngasalApiEmail = partsApiEmail.join('');
      const apiEmail = atob(ngasalApiEmail);

      const partsServiceName = ['c2lyZW4='];
      const ngasalServiceName = partsServiceName.join('');
      const serviceName = atob(ngasalServiceName);

      const partsRootDomain = [
        'dnBuLmtp',
        'aWtrcmlr',
        'LnRlY2g=',
      ];
      const ngasalRootDomain = partsRootDomain.join('');
      const rootDomain = atob(ngasalRootDomain);

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
