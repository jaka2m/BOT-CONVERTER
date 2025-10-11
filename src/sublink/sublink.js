export const handleTelegramUpdate = async (bot, update, userSessions, fileExtensions) => {
    if (update.message) {
        const msg = update.message;
        const text = msg.text;

        // Check for the /sublink command
        if (text && text.startsWith('/sublink')) {
            await handleSublinkCommand(bot, msg, userSessions);
        }
        // Handle text input for bug, country, or limit (if a session is active)
        else {
            await handleMessage(bot, msg, userSessions, fileExtensions);
        }
    }
    // Handle callback queries (from inline keyboard buttons)
    else if (update.callback_query) {
        const query = update.callback_query;
        await handleCallbackQuery(bot, query, userSessions, fileExtensions);
    }
    // You can add more handling for other update types if needed (e.g., edited_message, inline_query)
};

// --- Helper Functions for Bot Logic ---

// Handles the /sublink command, initiating the configuration process
const handleSublinkCommand = async (bot, msg, userSessions) => {
    const chatId = msg.chat.id;

    const keyboard = {
        inline_keyboard: [
            [{ text: "V2ray", callback_data: "v2ray" }, { text: "V2rayng", callback_data: "v2rayng" }],
            [{ text: "Clash", callback_data: "clash" }, { text: "Surfboard", callback_data: "surfboard" }],
            [{ text: "Singbox", callback_data: "singbox" }, { text: "Nekobox", callback_data: "nekobox" }],
            [{ text: "Husi", callback_data: "husi" }]
        ]
    };

    await bot.sendMessage(chatId, "📌 *Pilih aplikasi:*", {
        parse_mode: "Markdown",
        reply_markup: keyboard,
    });

    // Initialize session for the user
    userSessions[chatId] = { step: "choose_app" };
};

// Handles interactive button presses (callback queries)
const handleCallbackQuery = async (bot, query, userSessions) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Acknowledge the callback query to remove the loading state on the button
    await bot.sendMessage(query.id, "", { show_alert: false }); // You might need to change this line based on how `answerCallbackQuery` is handled in your `bot` object

    if (!userSessions[chatId]) return;

    const session = userSessions[chatId];

    if (session.step === "choose_app") {
        session.aplikasi = data;

        const keyboard = {
            inline_keyboard: [
                [{ text: "VLESS", callback_data: "vless" }, { text: "Trojan", callback_data: "trojan" }],
                [{ text: "Shadowsocks", callback_data: "shadowsocks" }]
            ]
        };

        await bot.editMessageText(chatId, query.message.message_id, "📌 *Pilih TypeConfig:*", {
            parse_mode: "Markdown",
            reply_markup: keyboard,
        });

        session.step = "choose_typeconfig";

    } else if (session.step === "choose_typeconfig") {
        session.typeconfig = data;

        await bot.editMessageText(chatId, query.message.message_id, "📌 *Masukkan Bug (contoh: quiz.int.vidio.com)*", {
            parse_mode: "Markdown"
        });

        session.step = "choose_bug";

    } else if (session.step === "choose_wildcard") {
        session.wildcard = data;

        const keyboard = {
            inline_keyboard: [
                [{ text: "True", callback_data: "true" }, { text: "False", callback_data: "false" }]
            ]
        };

        await bot.editMessageText(chatId, query.message.message_id, "📌 *Pilih TLS:*", {
            parse_mode: "Markdown",
            reply_markup: keyboard
        });

        session.step = "choose_tls";

    } else if (session.step === "choose_tls") {
        session.tls = data;

        await bot.editMessageText(chatId, query.message.message_id, "📌 *Masukkan kode negara (contoh: id, sg, us, random):*", {
            parse_mode: "Markdown"
        });

        session.step = "choose_country";
    }
};

// Handles text input from the user (for Bug, Country, and Limit steps)
const handleMessage = async (bot, msg, userSessions, fileExtensions) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userSessions[chatId]) return;

    const session = userSessions[chatId];

    if (session.step === "choose_bug") {
        session.bug = text;

        const keyboard = {
            inline_keyboard: [
                [{ text: "True", callback_data: "true" }, { text: "False", callback_data: "false" }]
            ]
        };

        await bot.sendMessage(chatId, "📌 *Pilih Wildcard:*", {
            parse_mode: "Markdown",
            reply_markup: keyboard,
        });

        session.step = "choose_wildcard";

    } else if (session.step === "choose_country") {
        session.country = text.toLowerCase();

        await bot.sendMessage(chatId, "📌 *Masukkan limit konfigurasi (angka):*", {
            parse_mode: "Markdown",
        });

        session.step = "choose_limit";

    } else if (session.step === "choose_limit") {
        if (isNaN(text) || parseInt(text) <= 0) {
            return bot.sendMessage(chatId, "❌ Limit harus berupa angka positif!");
        }

        session.limit = text;

        const fileExt = fileExtensions[session.aplikasi];
        const filename = `${session.aplikasi}.${fileExt}`;

        const url = `https://joss.gpj1.dpdns.org/vpn/${session.aplikasi}?type=${session.typeconfig}&bug=${session.bug}&tls=${session.tls}&wildcard=${session.wildcard}&limit=${session.limit}&country=${session.country}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const configContent = await response.text(); // Get the configuration content as text

            await bot.sendDocument(chatId, configContent, filename, {
                caption: `✅ Berikut file konfigurasi untuk *${session.aplikasi}*.`,
                parse_mode: "Markdown"
            });

        } catch (error) {
            console.error("Error fetching or sending configuration file:", error);
            await bot.sendMessage(chatId, "❌ Gagal mengunduh atau mengirim file konfigurasi.");
        } finally {
            // Always delete the session after completion or failure
            delete userSessions[chatId];
        }
    }
};
