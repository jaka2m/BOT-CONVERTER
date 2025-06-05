import { TelegramBot as _α } from './bot.js';
import { TelegramBotku as _β } from './randomip/bot2.js';
import { TelegramProxyCekBot as _γ } from './proxyip/botCek.js';
import { TelegramProxyBot as _δ } from './proxyip/bot3.js';
import { TelegramWildcardBot as _ε, KonstantaGlobalbot as _Ω } from './wildcard/botwild.js';
import { TelegramProxyBot as Bot6 } from './wildcard/cekxl.js';

const Ξ = (() => {
  const φ = (...x) => atob(x.join(''));
  return {
    λ: () => φ('NWZhZTlm','Y2I5YzE5','M2NlNjVk','ZTRiNTc2','ODlhOTQ5','MzhiNzA4ZQ=='),
    ψ: () => φ('ZTk5MzBk','NWNhNjgz','YjA0NjFm','NzM0Nzcw','NTBmZWUw','Yzc='),
    ρ: () => φ('ODA0MjNl','NzU0N2Qy','ZmE4NWUx','Mzc5NmEx','ZjQxZGVj','ZWQ='),
    σ: () => φ('YW1iZWJh','bG9uZ0Bn','bWFpbC5j','b20='),
    ω: () => φ('c2lyZW4='),
    η: () => φ('am9zcy5j','aGVja2Vy','LWlwLnh5','eg=='),
  };
})();

function Π(...ξ) {
  return ξ.map(ζ => ζ());
}

export default {
  async fetch(θ, π) {
    if (θ.method !== 'POST') {
      return new Response('nope', { status: 405 });
    }

    try {
      const υ = await θ.json();

      const τ = π.TELEGRAM_BOT_TOKEN;
      const μ = +π.OWNER_ID;

      const [ακ, βκ, γκ, δκ, εκ, ζκ] = Π(
        Ξ.λ,
        Ξ.ψ,
        Ξ.ρ,
        Ξ.σ,
        Ξ.ω,
        Ξ.η
      );

      const ωλ = new _Ω({
        apiKey: ακ,
        accountID: βκ,
        zoneID: γκ,
        apiEmail: δκ,
        serviceName: εκ,
        rootDomain: ζκ,
      });

      const bots = [
        new _α(τ, 'https://api.telegram.org', μ, ωλ),
        new _β(τ, 'https://api.telegram.org', μ, ωλ),
        new _γ(τ, 'https://api.telegram.org', μ, ωλ),
        new _δ(τ, 'https://api.telegram.org', μ, ωλ),
        new _ε(τ, 'https://api.telegram.org', μ, ωλ),
        const bot6 = new Bot6(token, 'https://api.telegram.org', ownerId, globalBot);
      
      ];

      await Promise.all(bots.map(b => b.handleUpdate(υ)));

      return new Response('👍', { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e?.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};
