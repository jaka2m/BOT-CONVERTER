// File: index.js

import { TelegramCekkuota } from './telegramCekkuota.js';

const TELEGRAM_TOKEN = '7791564952:AAEA-dUXRuKCANZiIaewTKWMv2oWRB071D4';
const bot = new TelegramCekkuota(TELEGRAM_TOKEN);

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        await bot.handleUpdate(update);
        return new Response('OK', { status: 200 });
      } catch (err) {
        console.error('Error processing update:', err);
        return new Response('Terjadi kesalahan saat memproses request.', { status: 500 });
      }
    }

    return new Response(
      '🤖 Bot Sidompul aktif.\nGunakan perintah /cekkuota 081234567890',
      { status: 200 }
    );
  }
};
