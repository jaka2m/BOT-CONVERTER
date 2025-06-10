import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './checkip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, KonstantaGlobalbot } from './wildcard/botwild.js';
import { CekkuotaBotku as Bot6 } from './kuota.js';
import { Converterbot as Bot7 } from './converter/converter.js';

export default {
  async fetch(request, env) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      // Get bot token and owner ID from Environment Variables
      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Decode API Key, Account ID, Zone ID, and API Email parts
      // It's highly recommended to store these as Environment Variables in Cloudflare Workers
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
      const zoneID = atob(ngasalZoneID); // This assumes both root domains are in the same zone. If not, you'll need logic to select the correct zoneID.

      const partsApiEmail = [
        'ZGVzYWxl',
        'a29uZzI0',
        'QGdtYWls',
        'LmNvbQ==',
      ];
      const ngasalApiEmail = partsApiEmail.join('');
      const apiEmail = atob(ngasalApiEmail);

      const serviceName = 'joss'; // Service name used

      // --- Logic to select the rootDomain based on the request host ---
      const availableRootDomains = ['krikkrik.tech', 'krikkriks.live']; // List of all available root domains
      let activeRootDomain;
      const host = request.headers.get('host'); // Get the host header from the request

      // Determine the active domain based on the host
      if (host && host.includes(availableRootDomains[1])) {
        activeRootDomain = availableRootDomains[1]; // Select krikkriks.live
      } else {
        activeRootDomain = availableRootDomains[0]; // Default to krikkrik.tech
      }
      
      // Initialize KonstantaGlobalbot with the determined activeRootDomain and all availableRootDomains
      const globalBot = new KonstantaGlobalbot({
        apiKey,
        accountID,
        zoneID,
        apiEmail,
        serviceName,
        activeRootDomain: activeRootDomain,       // The root domain that the current webhook request came from
        availableRootDomains: availableRootDomains, // All root domains supported by your bot
      });

      // Initialize all bot instances
      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot5 = new Bot5(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot6 = new Bot6(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot7 = new Bot7(token, 'https://api.telegram.org', ownerId, globalBot);

      // Run handleUpdate for each bot in parallel
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
      // Handle errors and return a JSON error response
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
