import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './checkip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, KonstantaGlobalbot } from './wildcard/botwild.js';
import { CekkuotaBotku as Bot6 } from './kuota.js';
import { Converterbot as Bot7 } from './converter/converter.js';

export default {
  async fetch(request, env) {
    // Hanya izinkan permintaan POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      // Ambil token bot dan ID pemilik dari Environment Variables
      const token = env.TELEGRAM_BOT_TOKEN;
      const ownerId = Number(env.OWNER_ID);

      // Dekode bagian-bagian API Key, Account ID, Zone ID, dan API Email
      // Sangat disarankan untuk menyimpan ini sebagai Environment Variables di Cloudflare Workers
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

      const serviceName = 'joss'; // Nama layanan yang digunakan

      // --- Logika untuk memilih rootDomain berdasarkan request host ---
      const rootDomains = ['krikkrik.tech', 'krikkriks.live']; // Daftar semua root domain yang tersedia
      let selectedRootDomain;
      const host = request.headers.get('host'); // Ambil header host dari permintaan

      // Tentukan domain aktif berdasarkan host
      if (host && host.includes(rootDomains[1])) {
        selectedRootDomain = rootDomains[1]; // Pilih krikkriks.live
      } else {
        selectedRootDomain = rootDomains[0]; // Default ke krikkrik.tech
      }
      
      // Penting: Pastikan `rootDomain` yang diteruskan ke `KonstantaGlobalbot` adalah root domain dasar,
      // bukan subdomain penuh seperti "joss.krikkrik.tech"
      const currentRootDomain = selectedRootDomain;


      // Inisialisasi KonstantaGlobalbot dengan rootDomain yang telah dipilih
      const globalBot = new KonstantaGlobalbot({
        apiKey,
        accountID,
        zoneID,
        apiEmail,
        serviceName,
        activeRootDomain: currentRootDomain, // root domain yang sedang aktif
        availableRootDomains: rootDomains,   // semua root domain yang didukung
      });

      // Inisialisasi semua instance bot
      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot5 = new Bot5(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot6 = new Bot6(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot7 = new Bot7(token, 'https://api.telegram.org', ownerId, globalBot);

      // Jalankan handleUpdate untuk setiap bot secara paralel
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
      // Tangani error dan kembalikan respons error JSON
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
