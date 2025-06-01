import TelegramBot from './bot.js';
import { TELEGRAM_BOT_TOKEN } from './utils.js';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

const rawBody = await Bun.stdin.text(); // Kalau pakai Bun
const update = JSON.parse(rawBody);

await bot.handleUpdate(update);
