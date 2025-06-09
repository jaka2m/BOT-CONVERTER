// Memetakan jenis konfigurasi ke ekstensi file yang sesuai
const fileExtensions = {
    clash: "yaml",
    singbox: "bpf",
    surfboard: "conf",
    nekobox: "json",
    husi: "json",
    v2ray: "txt",
    v2rayng: "txt"
};

// Objek untuk menyimpan sesi pengguna (misalnya, status percakapan, data sementara)
const userSessions = {};

// Mengimpor fungsi handleTelegramUpdate dari modul sublink.js
import { handleTelegramUpdate } from './sublink.js';

/**
 * Fungsi ini bisa digunakan untuk mencatat link bot atau keperluan debug lainnya.
 * @param {string} link - Link bot yang akan dicatat.
 */
export async function Linkku(link) {
    console.log("Bot link:", link);
    // Di sini Anda bisa menambahkan logika lain terkait link, seperti menyimpannya ke database atau melakukan validasi.
}

/**
 * Kelas Sublinkku menyediakan fungsionalitas untuk berinteraksi dengan API Telegram.
 * Ini mencakup pengiriman pesan, pengeditan pesan, dan pengiriman dokumen.
 */
export class Sublinkku {
    /**
     * Konstruktor untuk kelas Sublinkku.
     * @param {string} token - Token bot Telegram Anda.
     * @param {string} [apiUrl='https://api.telegram.org'] - URL dasar API Telegram.
     * @param {number} ownerId - ID pengguna pemilik bot.
     */
    constructor(token, apiUrl, ownerId) {
        this.token = token;
        this.apiUrl = apiUrl || 'https://api.telegram.org';
        this.ownerId = ownerId;
    }

    /**
     * Mengirim pesan teks ke chat tertentu di Telegram.
     * @param {number} chatId - ID chat Telegram.
     * @param {string} text - Teks pesan yang akan dikirim.
     * @param {object} [options={}] - Opsi tambahan untuk pengiriman pesan (misalnya parse_mode, reply_markup).
     */
    async sendMessage(chatId, text, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendMessage`; // Perbaiki URL API Telegram
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
                console.error(`Error sending message: ${response.status} ${response.statusText}`, errorData);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    /**
     * Mengedit pesan teks yang sudah ada di Telegram.
     * @param {number} chatId - ID chat Telegram.
     * @param {number} messageId - ID pesan yang akan diedit.
     * @param {string} text - Teks baru untuk pesan.
     * @param {object} [options={}] - Opsi tambahan untuk pengeditan pesan.
     */
    async editMessageText(chatId, messageId, text, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/editMessageText`; // Perbaiki URL API Telegram
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
                console.error(`Error editing message: ${response.status} ${response.statusText}`, errorData);
            }
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    /**
     * Mengirim dokumen (misalnya file konfigurasi) ke chat tertentu di Telegram.
     * @param {number} chatId - ID chat Telegram.
     * @param {string | Blob} documentContent - Konten dokumen dalam bentuk string atau Blob.
     * @param {string} filename - Nama file dokumen.
     * @param {object} [options={}] - Opsi tambahan untuk pengiriman dokumen (misalnya caption, parse_mode).
     */
    async sendDocument(chatId, documentContent, filename, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendDocument`; // Perbaiki URL API Telegram
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', new Blob([documentContent], { type: 'text/plain' }), filename); // Gunakan Blob untuk konten file
        if (options.caption) formData.append('caption', options.caption);
        if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData // fetch secara otomatis mengatur Content-Type untuk FormData
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Error sending document: ${response.status} ${response.statusText}`, errorData);
                // Fallback untuk mengirim pesan teks jika pengiriman dokumen gagal
                await this.sendMessage(chatId, `❌ Gagal mengirim file konfigurasi. Detail: ${errorData.description || errorData.error_code || 'Kesalahan tidak diketahui'}`);
            }
        } catch (error) {
            console.error('Error sending document:', error);
            // Fallback untuk mengirim pesan teks jika pengiriman dokumen gagal
            await this.sendMessage(chatId, `❌ Gagal mengirim file konfigurasi. Detail: ${error.message}`);
        }
    }
}
