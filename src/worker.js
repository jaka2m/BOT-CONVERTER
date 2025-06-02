import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './proxyip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5 } from './wildcard/botwild.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const ownerId = env.OWNER_ID; // Ambil owner ID dari env
      
      // Ambil semua secret dan config dari env
      const rootDomain = env.ROOT_DOMAIN;
      const apiKey = env.CLOUDFLARE_API_KEY;
      const accountID = env.CLOUDFLARE_ACCOUNT_ID;
      const zoneID = env.CLOUDFLARE_ZONE_ID;
      const apiEmail = env.API_EMAIL;
      const serviceName = env.SERVICE_NAME;

      // Buat instance bot dengan token dari env juga
      const bot1 = new Bot1(env.TELEGRAM_BOT_TOKEN, undefined, ownerId);
      const bot2 = new Bot2(env.TELEGRAM_BOT_TOKEN, undefined, ownerId);
      const bot3 = new Bot3(env.TELEGRAM_BOT_TOKEN, undefined, ownerId);
      const bot4 = new Bot4(env.TELEGRAM_BOT_TOKEN, undefined, ownerId);
      const bot5 = new Bot5(env.TELEGRAM_BOT_TOKEN, undefined, ownerId);

      // Contoh pakai apiKey atau rootDomain di salah satu bot jika perlu:
      // bot1.setConfig({ apiKey, rootDomain, accountID, zoneID, apiEmail, serviceName });

      // Jalankan handleUpdate dari tiap bot
      await Promise.all([
        bot1.handleUpdate(update),
        bot2.handleUpdate(update),
        bot3.handleUpdate(update),
        bot4.handleUpdate(update),
        bot5.handleUpdate(update)
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
