import TelegramBot from './bot.js';

const {
  API_KEY,
  API_EMAIL,
  ZONE_ID,
  SERVICE_NAME,
  ROOT_DOMAIN,
  TELEGRAM_BOT_TOKEN
} = process.env; // **JANGAN pakai ini, langsung pakai env parameter**

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();

        // Buat instance bot dengan token dan ownerId
        // ownerId 1467883032 contoh saja, sesuaikan dengan kamu
        const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, undefined, 1467883032);

        // Contoh penggunaan env variabel lain di fungsi bot.js, 
        // bisa passing juga kalau perlu, atau buat helper baru di sini.

        return bot.handleUpdate(update);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
