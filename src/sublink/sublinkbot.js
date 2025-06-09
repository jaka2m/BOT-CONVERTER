const fileExtensions = {
    clash: "yaml",
    singbox: "bpf",
    surfboard: "conf",
    nekobox: "json",
    husi: "json",
    v2ray: "txt",
    v2rayng: "txt"
};

const userSessions = {};

import { handleTelegramUpdate } from './sublink.js';

export async function Linkku(link) {
    console.log("Bot link:", link);
}

export class Sublinkku {
    constructor(token, apiUrl, ownerId) {
        if (!token) {
            console.error("Kesalahan: Token bot Telegram tidak boleh kosong.");
            throw new Error("Token bot diperlukan untuk menginisialisasi Sublinkku.");
        }
        this.token = token;
        this.apiUrl = (apiUrl || 'https://api.telegram.org').replace(/\/+$/, '');
        this.ownerId = ownerId;
    }

    async sendMessage(chatId, text, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
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
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Telegram API Error] Error sending message to chat ${chatId}: ${response.status} ${response.statusText}`, errorData);
            }
        } catch (error) {
            console.error(`[Network Error] Could not send message to chat ${chatId}:`, error);
        }
    }

    async editMessageText(chatId, messageId, text, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
        const payload = {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: options.parse_mode,
            reply_markup: options.reply_markup,
            disable_web_page_preview: options.disable_web_page_preview
        };
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Telegram API Error] Error editing message ${messageId} in chat ${chatId}: ${response.status} ${response.statusText}`, errorData);
            }
        } catch (error) {
            console.error(`[Network Error] Could not edit message ${messageId} in chat ${chatId}:`, error);
        }
    }

    async sendDocument(chatId, documentContent, filename, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', new Blob([documentContent], { type: 'text/plain' }), filename);
        
        if (options.caption) formData.append('caption', options.caption);
        if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Telegram API Error] Error sending document to chat ${chatId}: ${response.status} ${response.statusText}`, errorData);
                await this.sendMessage(chatId, 
                    `❌ Gagal mengirim file konfigurasi: ${filename}. ` +
                    `Detail: ${errorData.description || errorData.error_code || 'Kesalahan tidak diketahui'}`
                );
            }
        } catch (error) {
            console.error(`[Network Error] Could not send document to chat ${chatId}:`, error);
            await this.sendMessage(chatId, 
                `❌ Gagal mengirim file konfigurasi: ${filename}. ` +
                `Terjadi masalah jaringan atau internal: ${error.message}`
            );
        }
    }
}
