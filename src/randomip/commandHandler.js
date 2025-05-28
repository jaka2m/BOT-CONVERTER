import { randomip } from './randomip.js';

export async function handleCommand({ text, chatId, userId, sendMessage }) {
  if (text.startsWith('/randomip')) {
    await sendMessage(chatId, '⏳ Mengambil IP proxy acak...');
    const { text: resultText, buttons } = await randomip(userId, 1);
    await sendMessage(chatId, resultText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }
}
