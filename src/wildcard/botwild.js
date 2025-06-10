// ========================================
// Main Telegram Wildcard Bot Entry Point
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Global Constants & In-Memory Request Storage
// ========================================
export class KonstantaGlobalbot {
  // NEW: Menerima 'zoneIDs' sebagai objek/map, bukan 'zoneID' tunggal
  constructor({ apiKey, activeRootDomain, availableRootDomains, accountID, zoneIDs, apiEmail, serviceName }) {
    this.apiKey           = apiKey;
    this.activeRootDomain = activeRootDomain;
    this.availableRootDomains = availableRootDomains;
    this.accountID        = accountID;
    this.zoneIDs          = zoneIDs; // Menyimpan map Zone ID
    this.apiEmail         = apiEmail;
    this.serviceName      = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email':    this.apiEmail,
      'X-Auth-Key':      this.apiKey,
      'Content-Type':    'application/json',
    };

    if (!globalThis.subdomainRequests) globalThis.subdomainRequests = [];
  }

  // Escape text for MarkdownV2 safety
  escapeMarkdownV2(text) {
    return text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  // Cloudflare API: get list of Workers domains
  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      console.error(`Failed to fetch domain list: ${res.status} ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    
    // Filter domain berdasarkan serviceName dan pastikan domain berakhir dengan salah satu availableRootDomains
    return json.result
      .filter(d =>
        d.service === this.serviceName &&
        this.availableRootDomains.some(root => d.hostname.endsWith(`.${root}`))
      )
      .map(d => d.hostname);
  }

  // Cloudflare API: tambahkan subdomain
  async addSubdomain(subdomain, targetRootDomain = this.activeRootDomain) {
    // Pastikan targetRootDomain ada dalam daftar yang tersedia
    if (!this.availableRootDomains.includes(targetRootDomain)) {
      console.error(`Attempted to add subdomain to an invalid root domain: ${targetRootDomain}`);
      return 400; // Bad Request
    }

    // NEW: Dapatkan Zone ID yang benar untuk targetRootDomain
    const targetZoneID = this.zoneIDs[targetRootDomain];
    if (!targetZoneID) {
        console.error(`Zone ID not found for target root domain: ${targetRootDomain}`);
        return 400; // Bad Request jika Zone ID tidak ditemukan
    }

    const fullDomainName = `${subdomain}.${targetRootDomain}`.toLowerCase();
    
    if (!fullDomainName.endsWith(`.${targetRootDomain}`)) {
        console.error(`Generated domain ${fullDomainName} does not end with ${targetRootDomain}`);
        return 400;
    }

    const registered = await this.getDomainList();
    if (registered.includes(fullDomainName)) return 409; // Konflik - sudah ada

    try {
      // Uji apakah domain lengkap dapat diakses. Ini bisa gagal jika DNS belum sepenuhnya tersebar.
      const testRes = await fetch(`https://${fullDomainName}`, { method: 'HEAD', redirect: 'follow' });
      if (testRes.status === 530) {
        console.warn(`Cloudflare returned 530 for ${fullDomainName}. This might indicate DNS issues.`);
      }
    } catch (e) {
      console.error(`Error testing subdomain ${fullDomainName}:`, e.message);
      return 400; 
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname:    fullDomainName,
      service:     this.serviceName,
      zone_id:     targetZoneID // PENTING: Gunakan Zone ID yang benar di sini!
    };

    const res = await fetch(url, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify(body)
    });
    return res.status;
  }

  // Cloudflare API: hapus subdomain
  async deleteSubdomain(subdomain, targetRootDomain = null) {
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok) {
        console.error(`Failed to fetch domain list for deletion: ${listRes.status} ${listRes.statusText}`);
        return listRes.status;
    }
    const json = await listRes.json();
    
    let foundObj = null;

    // Jika targetRootDomain disediakan, coba cari di sana terlebih dahulu
    if (targetRootDomain && this.availableRootDomains.includes(targetRootDomain)) {
        const specificDomain = `${subdomain}.${targetRootDomain}`.toLowerCase();
        foundObj = json.result.find(d => d.hostname === specificDomain && d.service === this.serviceName);
    }

    // Jika tidak ditemukan, atau tidak ada targetRootDomain spesifik, cari di semua root domain yang tersedia
    if (!foundObj) {
        for (const root of this.availableRootDomains) {
            const potentialDomain = `${subdomain}.${root}`.toLowerCase();
            foundObj = json.result.find(d => d.hostname === potentialDomain && d.service === this.serviceName);
            if (foundObj) {
                targetRootDomain = root; // Perbarui targetRootDomain agar bisa merujuknya nanti
                break;
            }
        }
    }

    if (!foundObj) {
        return 404; // Tidak Ditemukan
    }

    // URL DELETE sekarang menggunakan ID domain yang ditemukan
    const res = await fetch(`${listUrl}/${foundObj.id}`, {
      method:  'DELETE',
      headers: this.headers
    });
    return res.status;
  }

  // ========================
  // In-Memory CRUD for subdomain requests
  // ========================
  saveDomainRequest(request) {
    globalThis.subdomainRequests.push(request);
  }

  findPendingRequest(subdomain, requesterId = null, rootDomainUsed = null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain &&
      r.status    === 'pending' &&
      (requesterId === null || r.requesterId === requesterId) &&
      (rootDomainUsed === null || r.rootDomainUsed === rootDomainUsed)
    );
  }

  updateRequestStatus(subdomain, status, rootDomainUsed = null) {
    const r = globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain && r.status === 'pending' &&
      (rootDomainUsed === null || r.rootDomainUsed === rootDomainUsed)
    );
    if (r) r.status = status;
  }

  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }
}

// ========================================
// Telegram Bot Handler: TelegramWildcardBot
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token     = token;
    this.apiUrl    = apiUrl || 'https://api.telegram.org';
    this.ownerId   = ownerId;
    this.globalBot = globalBot;

    this.awaitingAddList    = {};
    this.awaitingDeleteList = {};

    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    return this.globalBot.escapeMarkdownV2(text);
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    const chatId   = update.message.chat.id;
    const from     = update.message.from;
    const username = from.username || from.first_name || 'Unknown';
    const text     = update.message.text || '';
    const isOwner  = chatId === this.ownerId;
    const now      = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // ================================
    // 1) /add – support single & multi, now to ALL root domains
    // ================================
    if (text.startsWith('/add')) {
      const lines       = text.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0];
      const restLines = lines.slice(1);

      let subdomains = [];
      // Mode: /add abc def ghi
      if (firstLine.includes(' ') && restLines.length === 0) {
        subdomains = firstLine.split(' ').slice(1).map(s => s.trim()).filter(Boolean);
      }
      // Mode:
      // /add
      // abc
      // def
      else if (restLines.length > 0) {
        subdomains = restLines;
      }

      if (subdomains.length === 0) {
        await this.sendMessage(
          chatId,
          '```⚠️ \nMohon sertakan satu atau lebih subdomain setelah /add.\n```',
          { parse_mode: 'Markdown' }
        );
        return new Response('OK', { status: 200 });
      }

      const results = [];
      // Loop untuk setiap subdomain yang dimasukkan (misalnya 'hambaru')
      for (const sd of subdomains) {
        const cleanSd = sd.trim();
        
        // Loop untuk SETIAP root domain yang tersedia
        for (const targetRootDomain of this.globalBot.availableRootDomains) {
            const fullDomainForDisplay = `${cleanSd}.${targetRootDomain}`;

            if (isOwner) {
                let st = 500;
                try {
                    // Owner menambahkan ke SETIAP root domain yang tersedia
                    st = await this.globalBot.addSubdomain(cleanSd, targetRootDomain);
                } catch (e) {
                    console.error(`Error adding subdomain by owner to ${fullDomainForDisplay}: ${e.message}`);
                }
                results.push(
                    st === 200
                        ? '```✅-Wildcard\n' + this.escapeMarkdownV2(fullDomainForDisplay) + ' berhasil ditambahkan oleh owner.```'
                        : `❌ Gagal menambahkan domain *${this.escapeMarkdownV2(fullDomainForDisplay)}*, status: ${st}`
                );
            } else {
                try {
                    // Cek permintaan yang tertunda untuk subdomain spesifik ini di root domain spesifik ini
                    if (await this.globalBot.findPendingRequest(cleanSd, chatId, targetRootDomain)) {
                        results.push('```⚠️-Wildcard\n' + this.escapeMarkdownV2(fullDomainForDisplay) + ' sudah direquest dan menunggu approval.```');
                        continue; // Lewati ke root domain berikutnya jika sudah tertunda
                    }
                } catch (e) {
                    console.error(`Error checking pending request for ${fullDomainForDisplay}: ${e.message}`);
                }

                // Simpan permintaan untuk subdomain dan root domain spesifik ini
                this.globalBot.saveDomainRequest({
                    domain:            fullDomainForDisplay,
                    subdomain:         cleanSd,
                    requesterId:       chatId,
                    requesterUsername: username,
                    requestTime:       now,
                    status:            'pending',
                    rootDomainUsed:    targetRootDomain // Simpan root domain spesifik untuk permintaan ini
                });

                results.push(`\`\`\`✅ Request Wildcard ${this.escapeMarkdownV2(fullDomainForDisplay)} berhasil dikirim!\`\`\``);

                // Beri tahu owner (hanya jika bukan owner yang membuat permintaan)
                if (this.ownerId !== chatId) {
                    await this.sendMessage(this.ownerId,
                        `📬 Permintaan subdomain baru!
🔗 Domain: ${this.escapeMarkdownV2(fullDomainForDisplay)}
👤 Pengguna: @${this.escapeMarkdownV2(username)} (ID: ${this.escapeMarkdownV2(chatId.toString())})
📅 Waktu: ${this.escapeMarkdownV2(now)}`,
                        { parse_mode: 'MarkdownV2' }
                    );
                }
            }
        } // Akhir loop untuk targetRootDomain
      } // Akhir loop untuk subdomains

      await this.sendMessage(chatId, results.join('\n\n'), { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    // ================================
    // 2) /del – support single & multi (admin only)
    // ================================
    if (text.startsWith('/del')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang menggunakan perintah ini.');
        return new Response('OK', { status: 200 });
      }

      if (text === '/del') {
        this.awaitingDeleteList[chatId] = true;
        await this.sendMessage(
          chatId,
          `\`\`\`Contoh
📝 Silakan kirim daftar subdomain yang ingin dihapus (satu per baris).

/del
ava.game.naver.com
zaintest.vuclip.com
support.zoom.us
\`\`\``,
          { parse_mode: 'MarkdownV2' }
        );
        return new Response('OK', { status: 200 });
      }

      const lines       = text.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0];
      const restLines = lines.slice(1);

      let toDelete = [];
      if (firstLine.includes(' ') && restLines.length === 0) {
        toDelete = firstLine.split(' ').slice(1).map(s => s.trim()).filter(Boolean);
      }
      else if (restLines.length > 0) {
        toDelete = restLines;
      }

      if (toDelete.length === 0) {
        await this.sendMessage(chatId, '⚠️ Mohon sertakan satu atau lebih subdomain setelah /del.');
        return new Response('OK', { status: 200 });
      }

      const results = [];
      for (const raw of toDelete) {
        let d = raw.toLowerCase().trim();
        let sd;
        let targetRootDomainForDeletion = null;

        const matchedRoot = this.globalBot.availableRootDomains.find(root => d.endsWith(`.${root}`));
        if (matchedRoot) {
            sd = d.slice(0, d.lastIndexOf(`.${matchedRoot}`));
            targetRootDomainForDeletion = matchedRoot;
        } else {
            sd = d;
            targetRootDomainForDeletion = this.globalBot.activeRootDomain; // Fallback ke domain aktif
        }

        const fullDomainForDisplay = `${sd}.${targetRootDomainForDeletion}`;

        let st = 500;
        try {
            st = await this.globalBot.deleteSubdomain(sd, targetRootDomainForDeletion);
        } catch (e) {
            console.error(`Error deleting subdomain: ${e.message}`);
        }
        
        if (st === 200) results.push(`\`\`\`Wildcard\n${this.escapeMarkdownV2(fullDomainForDisplay)} deleted successfully.\`\`\``);
        else if (st === 404) results.push(`⚠️ Domain *${this.escapeMarkdownV2(fullDomainForDisplay)}* tidak ditemukan.`);
        else results.push(`❌ Gagal menghapus domain *${this.escapeMarkdownV2(fullDomainForDisplay)}*, status: ${st}.`);
      }

      await this.sendMessage(chatId, results.join('\n\n'), { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    // ================================
    // 3) /list
    // ================================
    if (text.startsWith('/list')) {
      let domains = [];
      try { domains = await this.globalBot.getDomainList(); } catch (e) {
        console.error(`Error getting domain list: ${e.message}`);
      }
      if (!domains.length) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const listText = domains.map((d,i) =>
          `${i+1}\\. \`${this.escapeMarkdownV2(d)}\``
        ).join('\n');

        await this.sendMessage(chatId,
          `🌐 LIST CUSTOM DOMAIN :\n\n${listText}\n\n📊 Total: *${domains.length}* subdomain${domains.length>1?'s':''}`,
          { parse_mode: 'MarkdownV2' }
        );
        const fileContent = domains.map((d,i)=>`${i+1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }
      return new Response('OK', { status: 200 });
    }

    // ================================
    // 4) /approve <subdomain>
    // ================================
    if (text.startsWith('/approve ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, `
\`\`\`
⛔ Anda tidak berwenang menggunakan perintah ini.
\`\`\`
`);
        return new Response('OK', { status: 200 });
      }
      const parts = text.split(' ');
      const sd = parts[1]?.trim();

      if (!sd) return new Response('OK', { status: 200 });
      
      let fullDomainForDisplay;
      let req = null;

      // Cari permintaan yang tertunda di semua root domain yang tersedia
      for (const root of this.globalBot.availableRootDomains) {
          req = this.globalBot.findPendingRequest(sd, null, root);
          if (req) {
              fullDomainForDisplay = req.domain;
              break;
          }
      }

      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${this.escapeMarkdownV2(sd)}*.`, { parse_mode: 'Markdown' });
      } else {
        let st = 500;
        try {
            // Gunakan rootDomainUsed dari permintaan untuk menambahkannya
            st = await this.globalBot.addSubdomain(req.subdomain, req.rootDomainUsed);
        } catch (e) {
            console.error(`Error approving subdomain: ${e.message}`);
        }
        if (st === 200) {
          this.globalBot.updateRequestStatus(req.subdomain, 'approved', req.rootDomainUsed);
          await this.sendMessage(chatId, `\`\`\`\n✅ Wildcard ${this.escapeMarkdownV2(fullDomainForDisplay)} disetujui dan ditambahkan.\n\`\`\``, { parse_mode: 'Markdown' });

          await this.sendMessage(req.requesterId, `\`\`\`\n✅ Permintaan Wildcard ${this.escapeMarkdownV2(fullDomainForDisplay)} Anda telah disetujui pada:\n${this.escapeMarkdownV2(now)}\n\`\`\``, { parse_mode: 'Markdown' });
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${this.escapeMarkdownV2(fullDomainForDisplay)}*, status: ${st}`, { parse_mode: 'Markdown' });
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ================================
    // 5) /reject <subdomain>
    // ================================
    if (text.startsWith('/reject ')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '```\n⛔ Anda tidak berwenang menggunakan perintah ini.\n```');
        return new Response('OK', { status: 200 });
      }
      const parts = text.split(' ');
      const sd = parts[1]?.trim();

      if (!sd) return new Response('OK', { status: 200 });
      
      let fullDomainForDisplay;
      let req = null;

      // Cari permintaan yang tertunda di semua root domain yang tersedia
      for (const root of this.globalBot.availableRootDomains) {
          req = this.globalBot.findPendingRequest(sd, null, root);
          if (req) {
              fullDomainForDisplay = req.domain;
              break;
          }
      }

      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${this.escapeMarkdownV2(sd)}*.`, { parse_mode: 'Markdown' });
      } else {
        this.globalBot.updateRequestStatus(sd, 'rejected', req.rootDomainUsed);
        await this.sendMessage(chatId,
          "```\n❌ Wildcard " + this.escapeMarkdownV2(fullDomainForDisplay) + " telah ditolak.\n```",
          { parse_mode: 'Markdown' });

        await this.sendMessage(req.requesterId,
          "```\n❌ Permintaan Wildcard " + this.escapeMarkdownV2(fullDomainForDisplay) + " Anda telah ditolak pada:\n" + this.escapeMarkdownV2(now) + "\n```",
          { parse_mode: 'Markdown' });
      }
      return new Response('OK', { status: 200 });
    }

    // ================================
    // 6) /req (lihat semua request)
    // ================================
    if (text.startsWith('/req')) {
      if (!isOwner) {
        await this.sendMessage(chatId, '⛔ Anda tidak berwenang melihat daftar request.', { parse_mode: 'MarkdownV2' });
        return new Response('OK', { status: 200 });
      }
      const all = this.globalBot.getAllRequests();
      if (!all.length) {
        await this.sendMessage(chatId, '📭 Belum ada request subdomain masuk.', { parse_mode: 'MarkdownV2' });
      } else {
        let lines = '';
        all.forEach((r, i) => {
          const domain        = this.escapeMarkdownV2(r.domain);
          const status        = this.escapeMarkdownV2(r.status);
          const requester     = this.escapeMarkdownV2(r.requesterUsername);
          const requesterId   = this.escapeMarkdownV2(r.requesterId.toString());
          const time          = this.escapeMarkdownV2(r.requestTime);
          const rootDomainUsed= this.escapeMarkdownV2(r.rootDomainUsed || 'N/A');

          lines += `*${i+1}\\. ${domain}* — _${status}_\n`;
          lines += `   requester: @${requester} \\(ID: ${requesterId}\\)\n`;
          lines += `   waktu: ${time}\n`;
          lines += `   root domain: ${rootDomainUsed}\n\n`;
        });
        const message = `📋 *Daftar Semua Request:*\n\n${lines}`;
        await this.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      }
      return new Response('OK', { status: 200 });
    }

    // fallback
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body:   formData
    });
  }
}
