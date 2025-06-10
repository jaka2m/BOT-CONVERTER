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
  constructor({ apiKey, activeRootDomain, availableRootDomains, accountID, zoneID, apiEmail, serviceName }) {
    this.apiKey           = apiKey;
    this.activeRootDomain = activeRootDomain; // Domain yang sedang aktif dari permintaan masuk
    this.availableRootDomains = availableRootDomains; // Daftar semua root domain yang didukung
    this.accountID        = accountID;
    this.zoneID           = zoneID;
    this.apiEmail         = apiEmail;
    this.serviceName      = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email':    this.apiEmail,
      'X-Auth-Key':      this.apiKey,
      'Content-Type':    'application/json',
    };

    // In-memory storage untuk permintaan subdomain
    if (!globalThis.subdomainRequests) globalThis.subdomainRequests = [];
  }

  // Escape teks agar aman untuk MarkdownV2
  escapeMarkdownV2(text) {
    return text.replace(/([_\*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  // Cloudflare API: ambil daftar domain Workers
  // Metode ini disesuaikan agar bisa mengambil daftar untuk semua root domain yang memungkinkan
  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      console.error(`Failed to fetch domain list: ${res.status} ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    
    // Filter domain berdasarkan serviceName dan salah satu dari availableRootDomains
    return json.result
      .filter(d =>
        d.service === this.serviceName &&
        this.availableRootDomains.some(root => d.hostname.endsWith(`.${root}`)) // Pastikan `.root` untuk match yang tepat
      )
      .map(d => d.hostname);
  }

  // Cloudflare API: tambahkan subdomain
  // Parameter `targetRootDomain` ditambahkan untuk menentukan ke root domain mana subdomain akan ditambahkan
  async addSubdomain(subdomain, targetRootDomain) {
    // Jika targetRootDomain tidak disediakan, gunakan activeRootDomain
    const domainToUse = targetRootDomain || this.activeRootDomain;

    // Pastikan domainToUse adalah salah satu dari availableRootDomains
    if (!this.availableRootDomains.includes(domainToUse)) {
      console.error(`Attempted to add subdomain to an invalid root domain: ${domainToUse}`);
      return 400; // Bad Request
    }

    const fullDomainName = `${subdomain}.${domainToUse}`.toLowerCase();
    
    // Sanity check: pastikan subdomain yang dihasilkan benar-benar berakhir dengan root domain target
    if (!fullDomainName.endsWith(`.${domainToUse}`)) {
        console.error(`Generated domain ${fullDomainName} does not end with ${domainToUse}`);
        return 400;
    }

    const registered = await this.getDomainList(); // getDomainList sudah difilter untuk semua root domain
    if (registered.includes(fullDomainName)) return 409; // Conflict - already exists

    try {
      // Periksa apakah subdomain sudah responsif di salah satu domain
      // Ini adalah pemeriksaan tingkat tinggi, mungkin perlu disesuaikan
      // Pengujian ini mungkin gagal jika DNS belum sepenuhnya tersebar atau jika Worker tidak merespons
      const testRes = await fetch(`https://${fullDomainName}`, { method: 'HEAD' }); // Menggunakan HEAD untuk efisiensi
      if (testRes.status === 530) {
        // 530: Origin DNS error (terkadang jika domain tidak terdaftar atau belum siap)
        return 530;
      }
    } catch (e) {
      // Tangani error jaringan, misalnya jika domain tidak dapat dijangkau
      console.error(`Error testing subdomain ${fullDomainName}:`, e);
      // Jika terjadi error, mungkin berarti domain belum aktif atau ada masalah lain.
      // Kita bisa lanjutkan proses penambahan, asumsikan ini hanya pre-check.
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname:    fullDomainName,
      service:     this.serviceName,
      zone_id:     this.zoneID // zone_id harus sesuai dengan `domainToUse`
                               // Jika zoneID berbeda antar root domain, Anda harus menyimpan multiple zoneIDs
                               // atau mengambilnya secara dinamis. Contoh:
                               // const zoneIdForDomain = this.zoneIDs[domainToUse] || this.zoneID;
                               // `zone_id: zoneIdForDomain`
    };

    const res = await fetch(url, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify(body)
    });
    return res.status;
  }

  // Cloudflare API: hapus subdomain
  // Parameter `targetRootDomain` ditambahkan untuk menentukan dari root domain mana subdomain akan dihapus
  async deleteSubdomain(subdomain, targetRootDomain) {
    // Jika targetRootDomain tidak disediakan, kita perlu mencari di semua availableRootDomains
    let domainToDelete = '';
    let foundObj = null;

    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok) {
        console.error(`Failed to fetch domain list for deletion: ${listRes.status} ${listRes.statusText}`);
        return listRes.status;
    }
    const json = await listRes.json();
    
    // Coba temukan domain di activeRootDomain terlebih dahulu, lalu di availableRootDomains lainnya
    const possibleDomains = [this.activeRootDomain, ...this.availableRootDomains.filter(d => d !== this.activeRootDomain)];

    for (const root of possibleDomains) {
        const potentialDomain = `${subdomain}.${root}`.toLowerCase();
        foundObj = json.result.find(d => d.hostname === potentialDomain && d.service === this.serviceName);
        if (foundObj) {
            domainToDelete = potentialDomain;
            break;
        }
    }

    if (!foundObj) {
        return 404; // Not Found
    }

    const res = await fetch(`${listUrl}/${foundObj.id}`, {
      method:  'DELETE',
      headers: this.headers
    });
    return res.status;
  }

  // ========================
  // In-Memory CRUD untuk request subdomain
  // ========================
  // Pertimbangkan untuk menyimpan `rootDomain` di dalam request juga
  saveDomainRequest(request) {
    // request = { domain, subdomain, requesterId, requesterUsername, requestTime, status, rootDomainUsed }
    globalThis.subdomainRequests.push(request);
  }

  // Mungkin perlu memperhitungkan `rootDomain` saat mencari pending request
  findPendingRequest(subdomain, requesterId = null, rootDomainUsed = null) {
    return globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain &&
      r.status    === 'pending' &&
      (requesterId === null || r.requesterId === requesterId) &&
      (rootDomainUsed === null || r.rootDomainUsed === rootDomainUsed) // Pastikan untuk memfilter berdasarkan rootDomainUsed
    );
  }

  // Mungkin perlu memperhitungkan `rootDomain` saat mengupdate status
  updateRequestStatus(subdomain, status, rootDomainUsed = null) {
    const r = globalThis.subdomainRequests.find(r =>
      r.subdomain === subdomain && r.status === 'pending' &&
      (rootDomainUsed === null || r.rootDomainUsed === rootDomainUsed) // Pastikan untuk memfilter berdasarkan rootDomainUsed
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

    // Flags untuk menandai user yang menunggu kirim daftar
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

    // Gunakan activeRootDomain untuk keperluan display atau pembentukan domain yang aktif saat ini
    const currentDisplayRootDomain = this.globalBot.activeRootDomain;
    const currentFullServiceName = `${this.globalBot.serviceName}.${currentDisplayRootDomain}`;

    // ================================
    // 1) /add – support single & multi
    // ================================
    if (text.startsWith('/add')) {
      const lines       = text.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0];
      const restLines = lines.slice(1);

      let subdomains = [];
      // mode: /add abc def ghi
      if (firstLine.includes(' ') && restLines.length === 0) {
        subdomains = firstLine.split(' ').slice(1).map(s => s.trim()).filter(Boolean);
      }
      // mode:
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
      for (const sd of subdomains) {
        const cleanSd = sd.trim();
        // Gunakan currentDisplayRootDomain untuk membentuk domain penuh yang ditampilkan
        const fullDomainForDisplay = `${cleanSd}.${currentDisplayRootDomain}`;

        if (isOwner) {
          let st = 500;
          try {
            // Owner bisa menambahkan ke activeRootDomain atau, jika perlu, ke root domain lain
            // Saat ini, diasumsikan owner ingin menambah ke domain yang aktif
            st = await this.globalBot.addSubdomain(cleanSd, currentDisplayRootDomain);
          } catch (e) {
            console.error(`Error adding subdomain by owner: ${e.message}`);
          }
          results.push(
            st === 200
              ? '```✅-Wildcard\n' + fullDomainForDisplay + ' berhasil ditambahkan oleh owner.```'
              : `❌ Gagal menambahkan domain *${this.escapeMarkdownV2(fullDomainForDisplay)}*, status: ${st}`
          );
        } else {
          try {
            // Periksa request pending untuk subdomain dan root domain yang digunakan
            if (await this.globalBot.findPendingRequest(cleanSd, chatId, currentDisplayRootDomain)) {
              results.push('```⚠️-Wildcard\n' + fullDomainForDisplay + ' sudah direquest dan menunggu approval.```');
              continue;
            }
          } catch (e) {
            console.error(`Error checking pending request: ${e.message}`);
          }

          // simpan request dengan menyertakan rootDomainUsed
          this.globalBot.saveDomainRequest({
            domain:            fullDomainForDisplay, // Simpan domain penuh yang direquest
            subdomain:         cleanSd,
            requesterId:       chatId,
            requesterUsername: username,
            requestTime:       now,
            status:            'pending',
            rootDomainUsed:    currentDisplayRootDomain // Simpan root domain yang digunakan
          });

          results.push(`\`\`\`✅ Request Wildcard ${fullDomainForDisplay} berhasil dikirim!\`\`\``);

          // notif ke owner
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
      }

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

      // handle “/del” tanpa argumen → minta daftar
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

      // handle /del abc def ghi  atau multiline
      const lines       = text.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0];
      const restLines = lines.slice(1);

      let toDelete = [];
      // mode: /del abc def ghi
      if (firstLine.includes(' ') && restLines.length === 0) {
        toDelete = firstLine.split(' ').slice(1).map(s => s.trim()).filter(Boolean);
      }
      // mode:
      // /del
      // abc
      // def
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
        let targetRootDomainForDeletion = null; // Ini akan menyimpan root domain yang cocok

        // Cek apakah raw domain berakhir dengan salah satu root domain yang tersedia
        const matchedRoot = this.globalBot.availableRootDomains.find(root => d.endsWith(`.${root}`));
        if (matchedRoot) {
            sd = d.slice(0, d.lastIndexOf(`.${matchedRoot}`));
            targetRootDomainForDeletion = matchedRoot;
        } else {
            // Jika tidak cocok dengan root domain yang terdaftar, anggap itu subdomain untuk activeRootDomain
            sd = d; // Diasumsikan input adalah subdomain saja, misalnya "mywildcard"
            targetRootDomainForDeletion = currentDisplayRootDomain;
        }

        const fullDomainForDisplay = `${sd}.${targetRootDomainForDeletion}`; // Untuk pesan hasil

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
        // Ubah cara listText dibuat agar hanya domain yang ada di dalam backtick
        const listText = domains.map((d,i) =>
          `${i+1}\\. \`${this.escapeMarkdownV2(d)}\`` // Hanya domain yang di-backtick
        ).join('\n'); // Tetap pakai newline agar per baris

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
      const targetRootDomain = parts[2]?.trim() || null; // Opsional: owner bisa specify root domain

      if (!sd) return new Response('OK', { status: 200 });
      
      let fullDomainForDisplay;
      let req;

      // Cari request di semua availableRootDomains
      for (const root of this.globalBot.availableRootDomains) {
          req = this.globalBot.findPendingRequest(sd, null, root); // Cari di semua user
          if (req) {
              fullDomainForDisplay = req.domain; // Gunakan domain yang disimpan di request
              break;
          }
      }

      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${this.escapeMarkdownV2(sd)}*.`, { parse_mode: 'Markdown' });
      } else {
        let st = 500;
        try {
            // Gunakan rootDomainUsed dari request untuk menambahkannya
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
      const targetRootDomain = parts[2]?.trim() || null; // Opsional: owner bisa specify root domain

      if (!sd) return new Response('OK', { status: 200 });
      
      let fullDomainForDisplay;
      let req;

      // Cari request di semua availableRootDomains
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
        this.globalBot.updateRequestStatus(req.subdomain, 'rejected', req.rootDomainUsed);
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
          const domain        = this.escapeMarkdownV2(r.domain); // `r.domain` sudah lengkap (sub.root.tld)
          const status        = this.escapeMarkdownV2(r.status);
          const requester     = this.escapeMarkdownV2(r.requesterUsername);
          const requesterId   = this.escapeMarkdownV2(r.requesterId.toString());
          const time          = this.escapeMarkdownV2(r.requestTime);
          const rootDomainUsed= this.escapeMarkdownV2(r.rootDomainUsed || 'N/A'); // Tambahkan ini

          lines += `*${i+1}\\. ${domain}* — _${status}_\n`;
          lines += `   requester: @${requester} \\(ID: ${requesterId}\\)\n`;
          lines += `   waktu: ${time}\n`;
          lines += `   root domain: ${rootDomainUsed}\n\n`; // Tampilkan root domain yang digunakan
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
