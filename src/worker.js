import { TelegramBot as Bot1 } from './bot.js';
import { TelegramBotku as Bot2 } from './randomip/bot2.js';
import { TelegramProxyCekBot as Bot3 } from './checkip/botCek.js';
import { TelegramProxyBot as Bot4 } from './proxyip/bot3.js';
import { TelegramWildcardBot as Bot5, GlobalBotConstants } from './wildcard/botwild.js'; // Nama kelas diubah
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

      // --- PENTING: SARAN KEAMANAN ---
      // Daripada mendekode di sini, lebih baik langsung gunakan env variables
      // Jika Anda ingin mempertahankan dekode ini, pastikan nilai-nilai ini
      // digunakan untuk menginisialisasi GlobalBotConstants di dalam kelas itu sendiri
      // (sesuai dengan perubahan yang sudah saya lakukan pada botwild.js).
      //
      // Jika Anda sudah menyetel ini sebagai env variables di Cloudflare Workers:
      // env.CLOUDFLARE_API_KEY
      // env.CLOUDFLARE_ACCOUNT_ID
      // env.CLOUDFLARE_ZONE_ID
      // env.CLOUDFLARE_API_EMAIL
      // env.CLOUDFLARE_SERVICE_NAME (jika ada)
      // env.CLOUDFLARE_ROOT_DOMAINS (jika ada, sebagai string dipisahkan koma)
      //
      // Maka kode ini bisa dipermudah:
      // const globalBot = new GlobalBotConstants({
      //   apiKey: env.CLOUDFLARE_API_KEY,
      //   accountId: env.CLOUDFLARE_ACCOUNT_ID,
      //   zoneId: env.CLOUDFLARE_ZONE_ID,
      //   apiEmail: env.CLOUDFLARE_API_EMAIL,
      //   serviceName: env.CLOUDFLARE_SERVICE_NAME || 'joss',
      //   rootDomains: (env.CLOUDFLARE_ROOT_DOMAINS || 'joss.krikkrik.tech,joss.krikkriks.live').split(',').map(d => d.trim()),
      // });
      //
      // Untuk saat ini, saya akan tetap menggunakan pendekatan `new GlobalBotConstants()` tanpa argumen
      // karena skrip botwild.js yang sudah saya perbaiki menginisialisasi semua properti di dalamnya.
      // Jika Anda memutuskan untuk menggunakan env. variables, Anda perlu menyesuaikan konstruktor GlobalBotConstants
      // di botwild.js juga untuk menerima argumen tersebut.
      // --- AKHIR PENTING: SARAN KEAMANAN ---

      // Inisialisasi GlobalBotConstants tanpa argumen,
      // karena semua konfigurasi sudah ada di dalam kelasnya.
      const globalBot = new GlobalBotConstants();

      const bot1 = new Bot1(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot2 = new Bot2(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot3 = new Bot3(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot4 = new Bot4(token, 'https://api.telegram.org', ownerId, globalBot);
      // Menginisialisasi Bot5 (WildcardBot) dengan globalBot yang baru
      const bot5 = new Bot5(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot6 = new Bot6(token, 'https://api.telegram.org', ownerId, globalBot);
      const bot7 = new Bot7(token, 'https://api.telegram.org', ownerId, globalBot);

      // Jalankan semua bot secara paralel
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
      console.error('Error handling Telegram update:', error);
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
