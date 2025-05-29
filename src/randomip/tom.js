export async function handleCommand({ text, chatId, userId, sendMessage }) {
  // Your code to handle the command here
  await sendMessage(chatId, `Received text: ${text}`);
}

// Usage example for the callback part:

async function handleRequest({ callback, sendMessage, answerCallback, editMessageReplyMarkup, token, apiUrl }) {
  if (callback) {
    await handleCallback({
      callback,
      sendMessage,
      answerCallback,
      editMessageReplyMarkup,
      token,
      apiUrl,
    });
  }

  return new Response('OK', { status: 200 });
}
