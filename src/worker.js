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
      const partsApiKey = [
        'NWZhZTlm',
        'Y2I5YzE5',
        'M2NlNjVk',
        'ZTRiNTc2',
        'ODlhOTQ5',
        'MzhiNzA4ZQ==',
      ];
      const ngasalApiKey = partsApiKey.join('');
      const apiKey = atob(ngasalApiKey);

      // Encode accountID
      const partsAccountID = [
        'ZTk5MzBk',
        'NWNhNjgz',
        'YjA0NjFm',
        'NzM0Nzcw',
        'NTBmZWUw',
        'Yzc=',
      ];
      const ngasalAccountID = partsAccountID.join('');
      const accountID = atob(ngasalAccountID);

      // Encode zoneID
      const partsZoneID = [
        'ODA0MjNl',
        'NzU0N2Qy',
        'ZmE4NWUx',
        'Mzc5NmEx',
        'ZjQxZGVj',
        'ZWQ=',
      ];
      const ngasalZoneID = partsZoneID.join('');
      const zoneID = atob(ngasalZoneID);

      // Encode apiEmail
      const partsApiEmail = [
        'YW1iZWJh',
        'bG9uZ0Bn',
        'bWFpbC5j',
        'b20=',
      ];
      const ngasalApiEmail = partsApiEmail.join('');
      const apiEmail = atob(ngasalApiEmail);

      // Encode serviceName
      const partsServiceName = ['c2lyZW4='];
      const ngasalServiceName = partsServiceName.join('');
      const serviceName = atob(ngasalServiceName);

      // Encode rootDomain
      const partsRootDomain = [
        'am9zcy5j',
        'aGVja2Vy',
        'LWlwLnh5',
        'eg==',
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
