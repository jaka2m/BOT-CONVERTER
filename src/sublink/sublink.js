// src/sublink/sublink.js

// Memetakan jenis konfigurasi ke ekstensi file yang sesuai
const fileExtensions = {
    clash: "yaml",
    singbox: "bpf",
    surfboard: "conf",
    nekobox: "json",
    husi: "json",
    v2ray: "txt",
    v2rayng: "txt"
}; // Penting: Pastikan ada titik koma di sini!

// Objek untuk menyimpan sesi pengguna (misalnya, status percakapan, data sementara).
// Ini bisa digunakan untuk melacak interaksi pengguna.
const userSessions = {};

// Mengimpor fungsi handleTelegramUpdate dari modul sublink.js
// (Pastikan file './sublink.js' ini ada dan berisi fungsi tersebut jika Anda mengimpornya dari diri sendiri.
//  Jika 'handleTelegramUpdate' adalah fungsi lain yang tidak relevan dengan bot Telegram,
//  Anda mungkin perlu menyesuaikan impor ini atau menghapusnya jika tidak digunakan.)
import { handleTelegramUpdate } from './sublink.js'; // Asumsi: ini mengimpor fungsi dari file ini sendiri atau ada file lain dengan nama yang sama.

/**
 * Fungsi ini bisa digunakan untuk mencatat link bot atau keperluan debug lainnya.
 * Biasanya, fungsi ini dipanggil saat bot diinisialisasi atau saat menerima link tertentu.
 * @param {string} link - Link bot yang akan dicatat.
 */
export async function Linkku(link) {
    console.log("Bot link:", link);
    // Anda bisa menambahkan logika lain di sini, seperti:
    // - Menyimpan link ke database
    // - Melakukan validasi format link
    // - Mengirim notifikasi bahwa bot telah diinisialisasi dengan link ini
}

/**
 * Kelas `Sublinkku` menyediakan fungsionalitas untuk berinteraksi dengan API Telegram.
 * Ini mencakup metode untuk mengirim pesan, mengedit pesan, dan mengirim dokumen (file).
 * Kelas ini dirancang untuk dapat diinstansiasi dengan token bot, URL API, dan ID pemilik bot.
 */
export class Sublinkku {
    /**
     * Konstruktor untuk kelas `Sublinkku`.
     * @param {string} token - Token bot Telegram Anda, diperoleh dari BotFather.
     * @param {string} [apiUrl='https://api.telegram.org'] - URL dasar API Telegram.
     * Defaultnya adalah URL resmi Telegram API.
     * @param {number} ownerId - ID pengguna Telegram dari pemilik bot.
     * Berguna untuk membatasi akses ke perintah tertentu atau untuk notifikasi.
     */
    constructor(token, apiUrl, ownerId) {
        if (!token) {
            console.error("Kesalahan: Token bot Telegram tidak boleh kosong.");
            throw new Error("Token bot diperlukan untuk menginisialisasi Sublinkku.");
        }
        this.token = token;
        // Pastikan apiUrl berakhir dengan slash jika tidak ada atau tambahkan default
        this.apiUrl = (apiUrl || 'https://api.telegram.org').replace(/\/+$/, ''); 
        this.ownerId = ownerId;
    }

    /**
     * Mengirim pesan teks ke chat tertentu di Telegram.
     * Menggunakan metode `sendMessage` dari Telegram Bot API.
     * @param {number} chatId - ID chat Telegram (bisa ID user atau group).
     * @param {string} text - Teks pesan yang akan dikirim.
     * @param {object} [options={}] - Opsi tambahan untuk pengiriman pesan.
     * @param {string} [options.parse_mode] - Mode parsing (misal: 'MarkdownV2', 'HTML').
     * @param {object} [options.reply_markup] - Objek keyboard markup (misal: InlineKeyboardMarkup, ReplyKeyboardMarkup).
     * @param {boolean} [options.disable_web_page_preview] - Menonaktifkan pratinjau tautan.
     * @param {number} [options.reply_to_message_id] - ID pesan yang akan dibalas.
     * @param {boolean} [options.allow_sending_without_reply] - Izinkan pengiriman tanpa balasan jika pesan asli tidak ditemukan.
     */
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
                // throw new Error(`Failed to send message: ${errorData.description || 'Unknown error'}`); // Bisa dilemparkan jika Anda ingin penanganan lebih lanjut
            }
        } catch (error) {
            console.error(`[Network Error] Could not send message to chat ${chatId}:`, error);
        }
    }

    /**
     * Mengedit pesan teks yang sudah ada di Telegram.
     * Menggunakan metode `editMessageText` dari Telegram Bot API.
     * @param {number} chatId - ID chat Telegram.
     * @param {number} messageId - ID pesan yang akan diedit.
     * @param {string} text - Teks baru untuk pesan.
     * @param {object} [options={}] - Opsi tambahan untuk pengeditan pesan.
     * @param {string} [options.parse_mode] - Mode parsing.
     * @param {object} [options.reply_markup] - Objek keyboard markup baru.
     * @param {boolean} [options.disable_web_page_preview] - Menonaktifkan pratinjau tautan.
     */
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
                // throw new Error(`Failed to edit message: ${errorData.description || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(`[Network Error] Could not edit message ${messageId} in chat ${chatId}:`, error);
        }
    }

    /**
     * Mengirim dokumen (misalnya file konfigurasi) ke chat tertentu di Telegram.
     * Menggunakan metode `sendDocument` dari Telegram Bot API.
     * @param {number} chatId - ID chat Telegram.
     * @param {string | Blob} documentContent - Konten dokumen dalam bentuk string atau Blob.
     * Jika string, akan dikonversi menjadi Blob.
     * @param {string} filename - Nama file dokumen yang akan ditampilkan di Telegram.
     * @param {object} [options={}] - Opsi tambahan untuk pengiriman dokumen.
     * @param {string} [options.caption] - Teks keterangan untuk dokumen.
     * @param {string} [options.parse_mode] - Mode parsing untuk caption.
     */
    async sendDocument(chatId, documentContent, filename, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendDocument`;
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        // Penting: Gunakan Blob untuk konten file.
        // Jika documentContent adalah string, Blob akan dibuat dari string tersebut.
        // Tipe 'text/plain' cocok untuk file konfigurasi teks.
        formData.append('document', new Blob([documentContent], { type: 'text/plain' }), filename);
        
        if (options.caption) formData.append('caption', options.caption);
        if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData // `fetch` secara otomatis mengatur Content-Type untuk FormData
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Telegram API Error] Error sending document to chat ${chatId}: ${response.status} ${response.statusText}`, errorData);
                // Fallback: Kirim pesan teks jika pengiriman dokumen gagal
                await this.sendMessage(chatId, 
                    `❌ Gagal mengirim file konfigurasi: ${filename}. ` +
                    `Detail: ${errorData.description || errorData.error_code || 'Kesalahan tidak diketahui'}`
                );
            }
        } catch (error) {
            console.error(`[Network Error] Could not send document to chat ${chatId}:`, error);
            // Fallback: Kirim pesan teks jika terjadi error jaringan atau lainnya
            await this.sendMessage(chatId, 
                `❌ Gagal mengirim file konfigurasi: ${filename}. ` +
                `Terjadi masalah jaringan atau internal: ${error.message}`
            );
        }
    }
}
