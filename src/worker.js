import { TelegramBot as __𝓍 } from './bot.js';
import { TelegramBotku as ___𝓍𝓍 } from './randomip/bot2.js';
import { TelegramProxyCekBot as 𝕏𝕏𝕏 } from './proxyip/botCek.js';
import { TelegramProxyBot as $$𝓉 } from './proxyip/bot3.js';
import { TelegramWildcardBot as _𝖶𝖣, KonstantaGlobalbot as __𝖪𝖦 } from './wildcard/botwild.js';

const Ω = (() => {
  const α = (...x) => atob(x.join(''));
  return {
    a: () => α('NWZhZTlm', 'Y2I5YzE5', 'M2NlNjVk', 'ZTRiNTc2', 'ODlhOTQ5', 'MzhiNzA4ZQ=='),
    b: () => α('ZTk5MzBk', 'NWNhNjgz', 'YjA0NjFm', 'NzM0Nzcw', 'NTBmZWUw', 'Yzc='),
    c: () => α('ODA0MjNl', 'NzU0N2Qy', 'ZmE4NWUx', 'Mzc5NmEx', 'ZjQxZGVj', 'ZWQ='),
    d: () => α('YW1iZWJh', 'bG9uZ0Bn', 'bWFpbC5j', 'b20='),
    e: () => α('c2lyZW4='),
    f: () => α('am9zcy5j', 'aGVja2Vy', 'LWlwLnh5', 'eg=='),
  };
})();

const 𝕄𝕒𝕤𝕜 = (...f) => f.map(fn => fn());

export default {
  async fetch(🅐, 🅑) {
    if (🅐.method !== 'POST') return new Response('⛔️', { status: 405 });

    try {
      const 🅒 = await 🅐.json();
      const 🅓 = 🅑.TELEGRAM_BOT_TOKEN;
      const 🅔 = +🅑.OWNER_ID;

      const [🄰, 🄱, 🄲, 🄳, 🄴, 🄵] = 𝕄𝕒𝕤𝕜(Ω.a, Ω.b, Ω.c, Ω.d, Ω.e, Ω.f);

      const 🅕 = new __𝖪𝖦({
        apiKey: 🄰,
        accountID: 🄱,
        zoneID: 🄲,
        apiEmail: 🄳,
        serviceName: 🄴,
        rootDomain: 🄵,
      });

      const 🅖 = [
        new __𝓍(🅓, 'https://api.telegram.org', 🅔, 🅕),
        new ___𝓍𝓍(🅓, 'https://api.telegram.org', 🅔, 🅕),
        new 𝕏𝕏𝕏(🅓, 'https://api.telegram.org', 🅔, 🅕),
        new $$𝓉(🅓, 'https://api.telegram.org', 🅔, 🅕),
        new _𝖶𝖣(🅓, 'https://api.telegram.org', 🅔, 🅕),
      ];

      await Promise.all(🅖.map(🆇 => 🆇.handleUpdate(🅒)));

      return new Response('✅', { status: 200 });
    } catch (🅨) {
      return new Response(JSON.stringify({ 🆄: 🅨.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
