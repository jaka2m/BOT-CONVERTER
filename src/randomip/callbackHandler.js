import { getIpDetail, getFlagEmoji, randomip } from './randomip.js';

export async function handleCallback({ callback, sendMessage, answerCallback, editMessageReplyMarkup }) {
  const { data, message, from, id: callbackId } = callback;

  if (data.startsWith('DETAIL_')) {
    const code = data.split('_')[1];
    const detailList = getIpDetail(from.id, code);

    if (!detailList) {
      await answerCallback(callbackId, 'Data tidak ditemukan.');
      return;
    }

    const detailText = `*Detail IP dari ${code} ${getFlagEmoji(code)}:*\n\n${detailList.join('\n\n')}`;
    await sendMessage(message.chat.id, detailText, { parse_mode: 'Markdown' });
    await answerCallback(callbackId);

  } else if (data.startsWith('PAGE_')) {
    const page = parseInt(data.split('_')[1], 10);
    const { text, buttons } = await randomip(from.id, page);

    await editMessageReplyMarkup(message.chat.id, message.message_id, buttons);
    await answerCallback(callbackId);
  }
}

export async function answerCallback(callbackId, text = '') {
  const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text,
      show_alert: false
    })
  });
}

export async function editMessageReplyMarkup(chatId, messageId, inlineKeyboard) {
  const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: inlineKeyboard }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}
