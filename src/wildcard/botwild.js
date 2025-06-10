/**
 * Fungsi utama untuk bot Wildcard.
 * @param {string} link - Link yang relevan untuk bot.
 */
export async function WildcardBot(link) {
  console.log("Bot link:", link);
  // Anda bisa menambahkan logika inisialisasi bot atau penanganan request di sini
}

/**
 * Kelas untuk mengelola konstanta global dan interaksi dengan Cloudflare API.
 */
export class GlobalBotConstants {
  constructor() {
    // --- PENTING: SARAN KEAMANAN (ulangi dari sebelumnya) ---
    // Pastikan nilai-nilai ini diambil dari environment variables atau konfigurasi yang aman
    // Untuk tujuan demonstrasi, saya biarkan hardcoded seperti skrip asli Anda,
    // namun sekarang dalam struktur yang lebih terorganisir untuk multiple domains.
    // --------------------------------------------------------

    this.apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
    this.apiEmail = "ambebalong@gmail.com";
    this.serviceName = "joss";

    // Struktur baru untuk mengelola multiple root domains dengan Account ID dan Zone ID-nya
    this.domainConfigs = [
      {
        rootDomain: "joss.krikkrik.tech",
        accountId: "d7660aa2e06f4af1d5becb80c0358522", // Account ID untuk joss.krikkrik.tech
        zoneId: "d33a71c24bf9c46d634f861e588ab887", // Zone ID untuk joss.krikkrik.tech
      },
      {
        rootDomain: "joss.krikkriks.live", // Contoh root domain kedua
        accountId: "d7660aa2e06f4af1d5becb80c0358522", // GANTI dengan Account ID yang benar untuk live
        zoneId: "7d3291ebb2fc3d4b95e0d46c81c138f0", // GANTI dengan Zone ID yang benar untuk live
      },
      // Tambahkan lebih banyak objek jika ada root domain lain
    ];

    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "X-Auth-Email": this.apiEmail,
      "X-Auth-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    // In-memory storage untuk permintaan subdomain
    if (!globalThis.subdomainRequests) globalThis.subdomainRequests = [];
  }

  /**
   * Meng-escape teks agar aman untuk format MarkdownV2 di Telegram.
   * @param {string} text - Teks yang akan di-escape.
   * @returns {string} Teks yang sudah di-escape.
   */
  escapeMarkdownV2(text) {
    // Regex yang lebih komprehensif untuk MarkdownV2
    return text.replace(/([_\*\[\]()~`>#+\-=|{}.!\\!?])/g, "\\$1");
  }

  /**
   * Mengambil konfigurasi domain berdasarkan root domain.
   * @param {string} rootDomain - Root domain yang dicari.
   * @returns {object|undefined} Objek konfigurasi domain jika ditemukan, undefined jika tidak.
   */
  getDomainConfig(rootDomain) {
    return this.domainConfigs.find(config => config.rootDomain === rootDomain);
  }

  /**
   * Mengambil daftar domain Workers dari Cloudflare untuk semua account/zone yang dikonfigurasi.
   * @returns {Promise<string[]>} Array berisi nama-nama host domain Workers.
   */
  async getWorkerDomainList() {
    let allDomains = [];
    for (const config of this.domainConfigs) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/domains`;
      try {
        const response = await fetch(url, { headers: this.headers });
        if (!response.ok) {
          console.error(
            `Failed to fetch worker domains for ${config.rootDomain}: ${response.status} ${response.statusText}`
          );
          continue; // Lanjutkan ke konfigurasi domain berikutnya
        }
        const data = await response.json();
        const domainsForThisConfig = data.result
          .filter((d) => d.service === this.serviceName)
          .map((d) => d.hostname);
        allDomains = allDomains.concat(domainsForThisConfig);
      } catch (error) {
        console.error(`Error getting worker domain list for ${config.rootDomain}:`, error);
      }
    }
    return allDomains;
  }

  /**
   * Menambahkan subdomain ke Cloudflare Workers.
   * @param {string} subdomain - Nama subdomain yang akan ditambahkan (misalnya "test").
   * @param {string} targetRootDomain - Root domain yang akan digunakan (misalnya "krikkrik.tech").
   * @returns {Promise<number>} Status code dari operasi penambahan.
   */
  async addSubdomain(subdomain, targetRootDomain) {
    const domainConfig = this.getDomainConfig(targetRootDomain);
    if (!domainConfig) {
      console.error(`Configuration not found for root domain: ${targetRootDomain}`);
      return 400; // Bad Request atau konfigurasi tidak ditemukan
    }

    const fullDomain = `${subdomain}.${targetRootDomain}`.toLowerCase();

    // Validasi dasar
    if (!fullDomain.endsWith(`.${targetRootDomain}`)) {
      return 400; // Bad Request
    }

    // Cek apakah sudah terdaftar di semua konfigurasi
    const registeredDomains = await this.getWorkerDomainList();
    if (registeredDomains.includes(fullDomain)) {
      return 409; // Conflict
    }

    // Coba akses subdomain untuk verifikasi awal (meskipun tidak selalu valid untuk semua kasus)
    try {
      const testRes = await fetch(`https://${fullDomain}`);
      if (testRes.status === 530) return 530;
    } catch (error) {
      console.warn(`Initial check for ${fullDomain} failed:`, error.message);
      return 400;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${domainConfig.accountId}/workers/domains`;
    const body = {
      environment: "production",
      hostname: fullDomain,
      service: this.serviceName,
      zone_id: domainConfig.zoneId,
    };

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(body),
      });
      return response.status;
    } catch (error) {
      console.error(`Error adding subdomain ${fullDomain}:`, error);
      return 500; // Internal Server Error
    }
  }

  /**
   * Menghapus subdomain dari Cloudflare Workers.
   * @param {string} subdomain - Nama subdomain yang akan dihapus (misalnya "test").
   * @param {string} targetRootDomain - Root domain yang akan digunakan (misalnya "krikkrik.tech").
   * @returns {Promise<number>} Status code dari operasi penghapusan.
   */
  async deleteSubdomain(subdomain, targetRootDomain) {
    const domainConfig = this.getDomainConfig(targetRootDomain);
    if (!domainConfig) {
      console.error(`Configuration not found for root domain: ${targetRootDomain}`);
      return 400; // Bad Request atau konfigurasi tidak ditemukan
    }

    const fullDomain = `${subdomain}.${targetRootDomain}`.toLowerCase();
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${domainConfig.accountId}/workers/domains`;

    try {
      const listRes = await fetch(listUrl, { headers: this.headers });
      if (!listRes.ok) {
        console.error(
          `Failed to get domain list for deletion from ${targetRootDomain}: ${listRes.status} ${listRes.statusText}`
        );
        return listRes.status;
      }

      const json = await listRes.json();
      const domainObj = json.result.find((d) => d.hostname === fullDomain);

      if (!domainObj) {
        return 404; // Not Found
      }

      const deleteRes = await fetch(`${listUrl}/${domainObj.id}`, {
        method: "DELETE",
        headers: this.headers,
      });
      return deleteRes.status;
    } catch (error) {
      console.error(`Error deleting subdomain ${fullDomain}:`, error);
      return 500; // Internal Server Error
    }
  }

  /**
   * Menyimpan permintaan domain baru ke penyimpanan in-memory.
   * @param {object} request - Objek permintaan domain.
   * @param {string} request.domain - Nama domain lengkap.
   * @param {string} request.subdomain - Subdomain saja.
   * @param {string} request.rootDomain - Root domain yang digunakan.
   * @param {number} request.requesterId - ID pengguna yang meminta.
   * @param {string} request.requesterUsername - Username pengguna yang meminta.
   * @param {string} request.requestTime - Waktu permintaan.
   * @param {string} request.status - Status permintaan (e.g., 'pending', 'approved', 'rejected').
   */
  saveDomainRequest(request) {
    globalThis.subdomainRequests.push(request);
  }

  /**
   * Mencari permintaan pending berdasarkan subdomain dan/atau requester ID.
   * @param {string} subdomain - Subdomain yang dicari.
   * @param {number|null} [requesterId=null] - ID pengguna yang meminta (opsional).
   * @returns {object|undefined} Objek permintaan jika ditemukan, undefined jika tidak.
   */
  findPendingRequest(subdomain, requesterId = null) {
    return globalThis.subdomainRequests.find(
      (r) =>
        r.subdomain === subdomain &&
        r.status === "pending" &&
        (requesterId === null || r.requesterId === requesterId)
    );
  }

  /**
   * Memperbarui status permintaan domain.
   * @param {string} subdomain - Subdomain dari permintaan yang akan diperbarui.
   * @param {string} status - Status baru (e.g., 'approved', 'rejected').
   * @returns {boolean} True jika permintaan ditemukan dan diperbarui, false jika tidak.
   */
  updateRequestStatus(subdomain, status) {
    const request = globalThis.subdomainRequests.find(
      (r) => r.subdomain === subdomain && r.status === "pending"
    );
    if (request) {
      request.status = status;
      return true;
    }
    return false;
  }

  /**
   * Mengambil semua permintaan domain yang tersimpan.
   * @returns {object[]} Array salinan dari semua permintaan domain.
   */
  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }
}

/**
 * Kelas untuk mengelola interaksi bot Telegram.
 */
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl || "https://api.telegram.org";
    this.ownerId = ownerId;
    this.globalBot = globalBot;

    // Flags untuk menandai user yang menunggu kirim daftar
    this.awaitingAddList = {};
    this.awaitingDeleteList = {};

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  /**
   * Mengirim pesan ke Telegram.
   * @param {number} chatId - ID chat penerima.
   * @param {string} text - Teks pesan.
   * @param {object} [options={}] - Opsi tambahan untuk pesan (misalnya parse_mode).
   */
  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    try {
      const response = await fetch(
        `${this.apiUrl}/bot${this.token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        console.error(
          `Failed to send message to chat ${chatId}: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(`Error sending message to chat ${chatId}:`, error);
    }
  }

  /**
   * Mengirim dokumen sebagai file ke Telegram.
   * @param {number} chatId - ID chat penerima.
   * @param {string} content - Konten file.
   * @param {string} filename - Nama file.
   * @param {string} mimeType - Tipe MIME file.
   */
  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append("chat_id", chatId.toString());
    formData.append(
      "document",
      new Blob([content], { type: mimeType }),
      filename
    );
    try {
      const response = await fetch(
        `${this.apiUrl}/bot${this.token}/sendDocument`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!response.ok) {
        console.error(
          `Failed to send document to chat ${chatId}: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(`Error sending document to chat ${chatId}:`, error);
    }
  }

  /**
   * Menangani pembaruan (update) dari Telegram.
   * @param {object} update - Objek pembaruan dari Telegram API.
   * @returns {Response} Respons HTTP OK.
   */
  async handleUpdate(update) {
    if (!update.message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const from = update.message.from;
    const username = from.username || from.first_name || "Unknown";
    const text = update.message.text || "";
    const isOwner = chatId === this.ownerId;
    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    // Helper untuk memformat pesan MarkdownV2
    const formatMsg = (msg) => ({ parse_mode: "MarkdownV2", text: msg });

    // --- Perintah /add ---
    if (text.startsWith("/add")) {
      const inputSubdomains = this.extractSubdomainsFromText(text);

      if (inputSubdomains.length === 0) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "⚠️ Mohon sertakan satu atau lebih subdomain setelah /add."
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const results = [];
      for (const sd of inputSubdomains) {
        const cleanSd = sd.trim();
        let addedSuccessfully = false;
        let rootDomainUsed = "";

        // Loop melalui setiap konfigurasi root domain yang tersedia
        for (const config of this.globalBot.domainConfigs) {
          const rDomain = config.rootDomain;
          const fullDomain = `${cleanSd}.${rDomain}`;

          if (isOwner) {
            let status = 500;
            try {
              status = await this.globalBot.addSubdomain(cleanSd, rDomain);
            } catch (e) {
              console.error(`Error adding ${fullDomain} as owner:`, e);
            }

            if (status === 200) {
              results.push(
                this.globalBot.escapeMarkdownV2(
                  `✅ Wildcard ${fullDomain} berhasil ditambahkan oleh owner.`
                )
              );
              addedSuccessfully = true;
              rootDomainUsed = rDomain;
              break; // Keluar dari loop domainConfigs jika berhasil
            } else if (status === 409) {
                results.push(
                    this.globalBot.escapeMarkdownV2(
                        `⚠️ Wildcard ${fullDomain} sudah terdaftar.`
                    )
                );
                addedSuccessfully = true; // Dianggap berhasil karena sudah ada
                rootDomainUsed = rDomain;
                break; // Keluar dari loop domainConfigs
            } else {
              results.push(
                this.globalBot.escapeMarkdownV2(
                  `❌ Gagal menambahkan domain ${fullDomain}, status: ${status}`
                )
              );
            }
          } else {
            // Logika untuk non-owner (permintaan)
            if (this.globalBot.findPendingRequest(cleanSd, chatId)) {
              results.push(
                this.globalBot.escapeMarkdownV2(
                  `⚠️ Wildcard ${fullDomain} sudah direquest dan menunggu approval.`
                )
              );
              addedSuccessfully = true;
              break;
            }

            // Simpan permintaan
            this.globalBot.saveDomainRequest({
              domain: fullDomain,
              subdomain: cleanSd,
              rootDomain: rDomain, // Simpan root domain yang digunakan
              requesterId: chatId,
              requesterUsername: username,
              requestTime: now,
              status: "pending",
            });

            results.push(
              this.globalBot.escapeMarkdownV2(
                `✅ Permintaan Wildcard ${fullDomain} berhasil dikirim!`
              )
            );
            addedSuccessfully = true;
            rootDomainUsed = rDomain;
            break; // Keluar dari loop domainConfigs jika berhasil
          }
        }
        if (!addedSuccessfully && !isOwner) {
          // Jika tidak berhasil ditambahkan/direquest di root domain manapun
          results.push(
            this.globalBot.escapeMarkdownV2(
              `⚠️ Tidak dapat memproses permintaan untuk ${cleanSd}. Pastikan subdomain valid dan root domain tersedia.`
            )
          );
        }

        // Notifikasi ke owner jika ada permintaan baru
        if (!isOwner && addedSuccessfully && rootDomainUsed) {
          await this.sendMessage(
            this.ownerId,
            this.globalBot.escapeMarkdownV2(
              `📬 Permintaan subdomain baru!\n\n🔗 Domain: ${cleanSd}.${rootDomainUsed}\n👤 Pengguna: @${username} (ID: ${chatId})\n📅 Waktu: ${now}`
            ),
            formatMsg("")
          );
        }
      }

      await this.sendMessage(chatId, results.join("\n\n"), formatMsg(""));
      return new Response("OK", { status: 200 });
    }

    // --- Perintah /del ---
    if (text.startsWith("/del")) {
      if (!isOwner) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "⛔ Anda tidak berwenang menggunakan perintah ini."
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const inputDomains = this.extractSubdomainsFromText(text); // Menggunakan "Domains" karena bisa full domain

      if (inputDomains.length === 0) {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            `📝 Silakan kirim daftar subdomain yang ingin dihapus (satu per baris).
Contoh:
/del
ava.game.naver.com
zaintest.vuclip.com
support.zoom.us`
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const results = [];
      for (const rawDomain of inputDomains) {
        const cleanDomain = rawDomain.toLowerCase().trim();
        let deletedSuccessfully = false;

        // Coba identifikasi root domain dari input
        let targetRootDomain = null;
        let subdomainOnly = cleanDomain;

        for (const config of this.globalBot.domainConfigs) {
          if (cleanDomain.endsWith(`.${config.rootDomain}`)) {
            targetRootDomain = config.rootDomain;
            subdomainOnly = cleanDomain.slice(0, cleanDomain.lastIndexOf(`.${config.rootDomain}`));
            break; // Ditemukan root domain yang cocok
          }
        }

        if (!targetRootDomain) {
          results.push(
            this.globalBot.escapeMarkdownV2(`⚠️ Domain ${cleanDomain} tidak sesuai dengan root domain terdaftar.`)
          );
          continue; // Lanjut ke domain berikutnya jika root domain tidak cocok
        }

        let status = 500;
        try {
          status = await this.globalBot.deleteSubdomain(subdomainOnly, targetRootDomain);
        } catch (e) {
          console.error(`Error deleting ${cleanDomain}:`, e);
        }

        if (status === 200) {
          results.push(
            this.globalBot.escapeMarkdownV2(
              `✅ Wildcard ${cleanDomain} berhasil dihapus.`
            )
          );
          deletedSuccessfully = true;
        } else if (status === 404) {
          results.push(
            this.globalBot.escapeMarkdownV2(
              `⚠️ Domain ${cleanDomain} tidak ditemukan.`
            )
          );
        } else {
          results.push(
            this.globalBot.escapeMarkdownV2(
              `❌ Gagal menghapus domain ${cleanDomain}, status: ${status}.`
            )
          );
        }
      }

      await this.sendMessage(chatId, results.join("\n\n"), formatMsg(""));
      return new Response("OK", { status: 200 });
    }

    // --- Perintah /list ---
    if (text.startsWith("/list")) {
      const domains = await this.globalBot.getWorkerDomainList();
      if (domains.length === 0) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "Belum ada subdomain terdaftar."
          ),
          formatMsg("")
        );
      } else {
        const listText = domains
          .map((d, i) => `${i + 1}\\. \`${this.globalBot.escapeMarkdownV2(d)}\``)
          .join("\n");

        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            `🌐 LIST CUSTOM DOMAIN :\n\n${listText}\n\n📊 Total: ${domains.length} subdomain`
          ),
          formatMsg("")
        );

        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join("\n");
        await this.sendDocument(
          chatId,
          fileContent,
          "wildcard-list.txt",
          "text/plain"
        );
      }
      return new Response("OK", { status: 200 });
    }

    // --- Perintah /approve ---
    if (text.startsWith("/approve ")) {
      if (!isOwner) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "⛔ Anda tidak berwenang menggunakan perintah ini."
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const parts = text.split(" ").slice(1).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) {
          await this.sendMessage(
              chatId,
              this.globalBot.escapeMarkdownV2(
                  "⚠️ Mohon sertakan subdomain yang ingin disetujui setelah /approve."
              ),
              formatMsg("")
          );
          return new Response("OK", { status: 200 });
      }

      const results = [];
      for (const sdInput of parts) {
          const req = this.globalBot.findPendingRequest(sdInput);
          if (!req) {
              results.push(
                  this.globalBot.escapeMarkdownV2(
                      `⚠️ Tidak ada request pending untuk subdomain ${sdInput}.`
                  )
              );
              continue;
          }

          let status = 500;
          try {
              status = await this.globalBot.addSubdomain(req.subdomain, req.rootDomain);
          } catch (e) {
              console.error(`Error approving ${req.domain}:`, e);
          }

          if (status === 200) {
              this.globalBot.updateRequestStatus(req.subdomain, "approved");
              results.push(
                  this.globalBot.escapeMarkdownV2(
                      `✅ Wildcard ${req.domain} disetujui dan ditambahkan.`
                  )
              );
              await this.sendMessage(
                  req.requesterId,
                  this.globalBot.escapeMarkdownV2(
                      `✅ Permintaan Wildcard ${req.domain} Anda telah disetujui pada:\n${now}`
                  ),
                  formatMsg("")
              );
          } else {
              results.push(
                  this.globalBot.escapeMarkdownV2(
                      `❌ Gagal menambahkan domain ${req.domain}, status: ${status}`
                  )
              );
          }
      }
      await this.sendMessage(chatId, results.join("\n\n"), formatMsg(""));
      return new Response("OK", { status: 200 });
    }

    // --- Perintah /reject ---
    if (text.startsWith("/reject ")) {
      if (!isOwner) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "⛔ Anda tidak berwenang menggunakan perintah ini."
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const parts = text.split(" ").slice(1).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) {
          await this.sendMessage(
              chatId,
              this.globalBot.escapeMarkdownV2(
                  "⚠️ Mohon sertakan subdomain yang ingin ditolak setelah /reject."
              ),
              formatMsg("")
          );
          return new Response("OK", { status: 200 });
      }

      const results = [];
      for (const sdInput of parts) {
          const req = this.globalBot.findPendingRequest(sdInput);
          if (!req) {
              results.push(
                  this.globalBot.escapeMarkdownV2(
                      `⚠️ Tidak ada request pending untuk subdomain ${sdInput}.`
                  )
              );
              continue;
          }

          this.globalBot.updateRequestStatus(sdInput, "rejected"); // Menggunakan sdInput karena ini yang dicari findPendingRequest
          results.push(
              this.globalBot.escapeMarkdownV2(
                  `❌ Wildcard ${req.domain} telah ditolak.`
              )
          );
          await this.sendMessage(
              req.requesterId,
              this.globalBot.escapeMarkdownV2(
                  `❌ Permintaan Wildcard ${req.domain} Anda telah ditolak pada:\n${now}`
              ),
              formatMsg("")
          );
      }
      await this.sendMessage(chatId, results.join("\n\n"), formatMsg(""));
      return new Response("OK", { status: 200 });
    }

    // --- Perintah /req (Lihat Semua Permintaan) ---
    if (text.startsWith("/req")) {
      if (!isOwner) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "⛔ Anda tidak berwenang melihat daftar request."
          ),
          formatMsg("")
        );
        return new Response("OK", { status: 200 });
      }

      const allRequests = this.globalBot.getAllRequests();
      if (allRequests.length === 0) {
        await this.sendMessage(
          chatId,
          this.globalBot.escapeMarkdownV2(
            "📭 Belum ada request subdomain masuk."
          ),
          formatMsg("")
        );
      } else {
        let lines = "";
        allRequests.forEach((r, i) => {
          const domain = this.globalBot.escapeMarkdownV2(r.domain);
          const status = this.globalBot.escapeMarkdownV2(r.status);
          const requester = this.globalBot.escapeMarkdownV2(r.requesterUsername);
          const requesterId = this.globalBot.escapeMarkdownV2(
            r.requesterId.toString()
          );
          const time = this.globalBot.escapeMarkdownV2(r.requestTime);

          lines += `*${i + 1}\\. ${domain}* — _${status}_\n`;
          lines += `   Pengguna: @${requester} \\(ID: ${requesterId}\\)\n`;
          lines += `   Waktu: ${time}\n\n`;
        });
        const message = this.globalBot.escapeMarkdownV2(
          `📋 *Daftar Semua Permintaan:*\n\n${lines}`
        );
        await this.sendMessage(chatId, message, formatMsg(""));
      }
      return new Response("OK", { status: 200 });
    }

    // --- Default / Help Message ---
    if (text === "/start" || text === "/help") {
        let helpMessage = `👋 Halo! Saya adalah bot untuk mengelola subdomain Wildcard.

Perintah yang tersedia:

\`\`\`
/add [subdomain(s)]
\`\`\`
Untuk menambahkan subdomain (misalnya, \`/add dev\`).
Anda juga bisa menambahkan beberapa sekaligus, pisahkan dengan spasi atau di baris baru:
\`\`\`
/add dev test
/add
beta
staging
\`\`\`

\`\`\`
/list
\`\`\`
Untuk melihat daftar semua subdomain yang terdaftar.

`;

        if (isOwner) {
            helpMessage += `*Perintah untuk Owner:*\n
\`\`\`
/del [subdomain(s)]
\`\`\`
Untuk menghapus subdomain. (Misalnya, \`/del dev.krikkrik.tech\`).

\`\`\`
/req
\`\`\`
Untuk melihat semua permintaan subdomain yang masuk.

\`\`\`
/approve [subdomain]
\`\`\`
Untuk menyetujui permintaan subdomain. (Misalnya, \`/approve beta\`).

\`\`\`
/reject [subdomain]
\`\`\`
Untuk menolak permintaan subdomain. (Misalnya, \`/reject beta\`).
`;
        }

        await this.sendMessage(
            chatId,
            this.globalBot.escapeMarkdownV2(helpMessage),
            formatMsg("")
        );
        return new Response("OK", { status: 200 });
    }

    // fallback
    return new Response("OK", { status: 200 });
  }

  /**
   * Mengekstrak subdomain dari teks perintah, mendukung format spasi dan multiline.
   * @param {string} text - Teks perintah dari pengguna.
   * @returns {string[]} Array berisi subdomain/domain yang diekstrak.
   */
  extractSubdomainsFromText(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0];
    const restLines = lines.slice(1);

    let items = [];

    // Jika perintah ada di baris pertama dan diikuti spasi (misal: /add abc def)
    if (firstLine.includes(" ")) {
        items = firstLine.split(" ").slice(1).map((s) => s.trim()).filter(Boolean);
    }

    // Jika ada baris selanjutnya (misal: /add \n abc \n def)
    if (restLines.length > 0) {
        items = [...items, ...restLines];
    }
    return items;
  }
}
