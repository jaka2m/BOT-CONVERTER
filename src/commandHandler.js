import { randomip } from './randomip.js';

export async function handleCommand({ text, chatId, userId, sendMessage, deleteMessage }) {
  if (text.startsWith('/randomip')) {
    // Kirim pesan loading dan simpan ID-nya
    const loadingMessage = await sendMessage(chatId, '⏳ Mengambil IP proxy acak...');
    const loadingMessageId = loadingMessage.message_id;

    // Ambil hasil dari randomip
    const { text: resultText, buttons } = await randomip(userId, 1);

    // Hapus pesan loading
    await deleteMessage(chatId, loadingMessageId).catch(() => {});

    // Kirim hasil akhir
    await sendMessage(chatId, resultText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }
}
