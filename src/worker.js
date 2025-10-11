import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './checkip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, KonstantaGlobalbot } from './wildcard/botwild.js';
import { CekkuotaBotku as Bot6 } from './kuota.js';
import { Converterbot as Bot7 } from './converter/converter.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Mengganti Base64 dengan string biasa
      const apiKey = '1d158d0efc4eef787222cefff0b6d20981462';
      const accountID = '87993bf4d63139b1d613cbb03c83e5de';
      const zoneID = '46379589cdb3be16cc113fa2582be2f9';
      const apiEmail = 'paoandest@gmail.com';

      // Mengganti serviceName menjadi "joss"
      const serviceName = 'joss';

      // Mengganti rootDomain menjadi "joss.krikkrik.tech"
      const rootDomain = 'gpj1.dpdns.org';

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
      const bot6 = new Bot6(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot7 = new Bot7(token, 'https://api.telegram.org', ownerId, globalBot);

      await Promise.all([
        bot1.handleUpdate(update),
        bot2.handleUpdate(update),
        bot3.handleUpdate(update),
        bot4.handleUpdate(update),
        bot5.handleUpdate(update),
        bot6.handleUpdate(update),
        bot7.handleUpdate(update),
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
