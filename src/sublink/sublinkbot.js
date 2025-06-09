// bot.js
import { handleTelegramUpdate } from './sublink.js';

export async function Linkku(link) {
  console.log("Bot link:", link);
}

export class Sublinkku {
  constructor(token, apiUrl, ownerId) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
  }

const userSessions = {};

const fileExtensions = {
    clash: "yaml",
    singbox: "bpf",
    surfboard: "conf",
    nekobox: "json",
    husi: "json",
    v2ray: "txt",
    v2rayng: "txt"
};

const sendMessage = async (chatId, text, options = {}) => {
    const url = `${this.apiUrl}sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode,
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview,
        reply_to_message_id: options.reply_to_message_id,
        allow_sending_without_reply: options.allow_sending_without_reply
    };
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

const editMessageText = async (chatId, messageId, text, options = {}) => {
    const url = `${this.apiUrl}editMessageText`;
    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: options.parse_mode,
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview
    };
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error editing message:', error);
    }
};

const sendDocument = async (chatId, documentContent, filename, options = {}) => {
    const url = `${this.apiUrl}sendDocument`;
    
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([documentContent], { type: 'text/plain' }), filename); // Use Blob for file content
    formData.append('caption', options.caption || '');
    if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

    try {
        await fetch(url, {
            method: 'POST',
            body: formData // fetch automatically sets Content-Type for FormData
        });
    } catch (error) {
        console.error('Error sending document:', error);
        // Fallback to sending a text message if document sending fails
        await sendMessage(chatId, `❌ Gagal mengirim file konfigurasi. Detail: ${error.message}`);
    }
};

