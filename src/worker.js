import TelegramBot from './bot.js';
import { TELEGRAM_BOT_TOKEN } from './itil.js';

async function main() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

  const rawBody = await Bun.stdin.text(); // kalau pakai Bun
  const update = JSON.parse(rawBody);

  await bot.handleUpdate(update);
}

main().catch(console.error);
