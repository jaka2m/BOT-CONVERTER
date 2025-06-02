import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot, CloudflareBot } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Buat instance CloudflareBot (untuk digunakan oleh TelegramWildcardBot)
      const cfBot = new CloudflareBot({
        rootDomain: env.ROOT_DOMAIN || 'joss.checker-ip.xyz', // sesuaikan jika perlu
        apiKey: env.API_KEY,
        apiEmail: env.API_EMAIL,
        accountID: env.ACCOUNT_ID,
        zoneID: env.ZONE_ID,
        serviceName: env.SERVICE_NAME || 'siren',
      });

      // Inisialisasi semua bot
      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId);
      const bot5 = new TelegramWildcardBot(token, 'https://api.telegram.org', ownerId, cfBot); // ← cfBot instance dikirim ke sini

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
