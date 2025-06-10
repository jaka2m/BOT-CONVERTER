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
  // Metode ini perlu disesuaikan agar bisa mengambil daftar untuk semua root domain yang memungkinkan
  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    const json = await res.json();
    
    // Filter domain berdasarkan serviceName dan salah satu dari availableRootDomains
    return json.result
      .filter(d => 
        d.service === this.serviceName &&
        this.availableRootDomains.some(root => d.hostname.endsWith(root))
      )
      .map(d => d.hostname);
  }

  // Cloudflare API: tambahkan subdomain
  // Parameter `targetRootDomain` ditambahkan untuk menentukan ke root domain mana subdomain akan ditambahkan
  async addSubdomain(subdomain, targetRootDomain = this.activeRootDomain) {
    // Pastikan targetRootDomain adalah salah satu dari availableRootDomains
    if (!this.availableRootDomains.includes(targetRootDomain)) {
      console.error(`Attempted to add subdomain to an invalid root domain: ${targetRootDomain}`);
      return 400; // Bad Request
    }

    const domain = `${subdomain}.${targetRootDomain}`.toLowerCase();
    if (!domain.endsWith(targetRootDomain)) return 400; // Sanity check

    const registered = await this.getDomainList(); // getDomainList sudah difilter untuk semua root domain
    if (registered.includes(domain)) return 409; // Conflict - already exists

    try {
      // Periksa apakah subdomain sudah responsif di salah satu domain
      // Ini adalah pemeriksaan tingkat tinggi, mungkin perlu disesuaikan
      const testRes = await fetch(`https://${domain}`);
      if (testRes.status === 530) {
        // 530: Origin DNS error (terkadang jika domain tidak terdaftar atau belum siap)
        // Ini bisa menjadi indikator yang ambigu, mungkin perlu validasi DNS yang lebih baik
        return 530; 
      }
    } catch (e) {
      // Tangani error jaringan, misalnya jika domain tidak dapat dijangkau
      console.error(`Error testing subdomain ${domain}:`, e);
      return 400; // Bad Request atau error lain
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname:    domain,
      service:     this.serviceName,
      zone_id:     this.zoneID // zone_id harus sesuai dengan `targetRootDomain`
                               // Jika zoneID berbeda antar root domain, Anda harus menyimpan multiple zoneIDs
                               // atau mengambilnya secara dinamis
    };

    // Catatan: Jika krikkrik.tech dan krikkriks.live memiliki Zone ID yang berbeda,
    // Anda perlu memetakan `targetRootDomain` ke `zone_id` yang benar di sini.
    // Untuk saat ini, saya asumsikan mereka berada di zone_id yang sama.
    // Jika tidak, Anda perlu menambahkan properti `zoneIDs: { 'krikkrik.tech': 'ID1', 'krikkriks.live': 'ID2' }`
    // ke konstruktor dan menggunakannya di sini: `zone_id: this.zoneIDs[targetRootDomain]`

    const res = await fetch(url, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify(body)
    });
    return res.status;
  }

  // Cloudflare API: hapus subdomain
  // Parameter `targetRootDomain` ditambahkan untuk menentukan dari root domain mana subdomain akan dihapus
  async deleteSubdomain(subdomain, targetRootDomain = this.activeRootDomain) {
    if (!this.availableRootDomains.includes(targetRootDomain)) {
      console.error(`Attempted to delete subdomain from an invalid root domain: ${targetRootDomain}`);
      return 400;
    }

    const domain  = `${subdomain}.${targetRootDomain}`.toLowerCase();
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok) return listRes.status;

    const json = await listRes.json();
    // Cari objek domain yang cocok (termasuk root domain yang spesifik)
    const obj   = json.result.find(d => d.hostname === domain);
    if (!obj) return 404;

    const res = await fetch(`${listUrl}/${obj.id}`, {
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
      (rootDomainUsed === null || r.rootDomainUsed === rootDomainUsed)
    );
  }

  // Mungkin perlu memperhitungkan `rootDomain` saat mengupdate status
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
    this.token      = token;
    this.apiUrl     = apiUrl || 'https://api.telegram.org';
    this.ownerId    = ownerId;
    this.globalBot  = globalBot;

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

    // ================================
    // 1) /add – support single & multi
    // ================================
    if (text.startsWith('/add')) {
      const lines     = text.split('\n').map(l => l.trim()).filter(Boolean);
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
        const full    = `${cleanSd}.${this.globalBot.rootDomain}`;

        if (isOwner) {
          let st = 500;
          try { st = await this.globalBot.addSubdomain(cleanSd); } catch {}
          results.push(
  st === 200
    ? '```✅-Wildcard\n' + full + ' berhasil ditambahkan oleh owner.```'
    : `❌ Gagal menambahkan domain *${full}*, status: ${st}`
);
        } else {
          try {
            if (await this.globalBot.findPendingRequest(cleanSd, chatId)) {
  results.push('```⚠️-Wildcard\n' + full + ' sudah direquest dan menunggu approval.\n```');
  continue;
}
} catch {}

          // simpan request
          this.globalBot.saveDomainRequest({
            domain:            full,
            subdomain:         cleanSd,
            requesterId:       chatId,
            requesterUsername: username,
            requestTime:       now,
            status:            'pending'
          });

          results.push(`\`\`\`✅ Request Wildcard ${full} berhasil dikirim!\`\`\``);

          // notif ke owner
          if (this.ownerId !== chatId) {
            await this.sendMessage(this.ownerId,
`📬 Permintaan subdomain baru!

🔗 Domain: ${full}
👤 Pengguna: @${username} (ID: ${chatId})
📅 Waktu: ${now}`);
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
  const lines     = text.split('\n').map(l => l.trim()).filter(Boolean);
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
    if (d.endsWith(`.${this.globalBot.rootDomain}`)) {
      sd = d.slice(0, d.lastIndexOf(`.${this.globalBot.rootDomain}`));
    } else {
      sd = d;
    }
    const full = `${sd}.${this.globalBot.rootDomain}`;

    let st = 500;
    try { st = await this.globalBot.deleteSubdomain(sd); } catch {}
    if      (st === 200) results.push(`\`\`\`Wildcard\n${full}deleted successfully.\`\`\``);
    else if (st === 404) results.push(`⚠️ Domain *${full}* tidak ditemukan.`);
    else                 results.push(`❌ Gagal menghapus domain *${full}*, status: ${st}.`);
  }

  await this.sendMessage(chatId, results.join('\n\n'), { parse_mode: 'Markdown' });
  return new Response('OK', { status: 200 });
}

    // ================================
    // 3) /list
    // ================================
    if (text.startsWith('/list')) {
  let domains = [];
  try { domains = await this.globalBot.getDomainList(); } catch {}
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
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req  = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${full}*.`, { parse_mode: 'Markdown' });
      } else {
        let st = 500;
        try { st = await this.globalBot.addSubdomain(sd); } catch {}
        if (st === 200) {
          this.globalBot.updateRequestStatus(sd, 'approved');
          await this.sendMessage(chatId, `\`\`\`\n✅ Wildcard ${full} disetujui dan ditambahkan.\n\`\`\``, { parse_mode: 'Markdown' });

await this.sendMessage(req.requesterId, `\`\`\`\n✅ Permintaan Wildcard ${full} Anda telah disetujui pada:\n${now}\n\`\`\``, { parse_mode: 'Markdown' });
} else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain *${full}*, status: ${st}`, { parse_mode: 'Markdown' });
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
      const sd = text.split(' ')[1]?.trim();
      if (!sd) return new Response('OK', { status: 200 });
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req  = this.globalBot.findPendingRequest(sd);
      if (!req) {
        await this.sendMessage(chatId, `⚠️ Tidak ada request pending untuk subdomain *${full}*.`, { parse_mode: 'Markdown' });
      } else {
        this.globalBot.updateRequestStatus(sd, 'rejected');
        await this.sendMessage(chatId, 
  "```\n❌ Wildcard " + full + " telah ditolak.\n```", 
  { parse_mode: 'Markdown' });

await this.sendMessage(req.requesterId, 
  "```\n❌ Permintaan Wildcard " + full + " Anda telah ditolak pada:\n" + now + "\n```", 
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
          const domain      = this.escapeMarkdownV2(r.domain);
          const status      = this.escapeMarkdownV2(r.status);
          const requester   = this.escapeMarkdownV2(r.requesterUsername);
          const requesterId = this.escapeMarkdownV2(r.requesterId.toString());
          const time        = this.escapeMarkdownV2(r.requestTime);

          lines += `*${i+1}\\. ${domain}* — _${status}_\n`;
          lines += `   requester: @${requester} \\(ID: ${requesterId}\\)\n`;
          lines += `   waktu: ${time}\n\n`;
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
