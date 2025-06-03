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
      const parts = ['NWZhZTlm', 'Y2I5YzE5', 'M2NlNjVk', 'ZTRiNTc2', 'ODlhOTQ5', 'MzhiNzA4ZQ=='];
      const ngasal = parts.join('');
      const apiKey = atob(ngasal);

      const globalBot = new KonstantaGlobalbot({
        apiKey,
        accountID: "e9930d5ca683b0461f73477050fee0c7",
        zoneID: "80423e7547d2fa85e13796a1f41deced",
        apiEmail: "ambebalong@gmail.com",
        serviceName: "siren",
        rootDomain: "joss.checker-ip.xyz",
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
