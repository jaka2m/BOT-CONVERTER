import { addsubdomain, deletesubdomain, listSubdomains } from './wildcard.js';

export default class TelegramBot {
  constructor(token, apiUrl, ownerId, ROOT_DOMAIN, API_KEY, API_EMAIL, SERVICE_NAME, ACCOUNT_ID, ZONE_ID) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.ownerId = ownerId;
    this.rootDomain = ROOT_DOMAIN;
    this.apiKey = API_KEY;
    this.apiEmail = API_EMAIL;
    this.serviceName = SERVICE_NAME;
    this.accountId = ACCOUNT_ID;
    this.zoneId = ZONE_ID;
  }

  async handleUpdate(ctx) {
    const text = ctx.message.text.split(' ');
    if (text.length < 2) {
      await ctx.reply('Masukkan subdomain yang ingin ditambahkan.\nContoh: /add mysubdomain');
      return;
    }

    const subdomain = text[1];
    const env = {
      API_KEY: this.apiKey,
      API_EMAIL: this.apiEmail,
      SERVICE_NAME: this.serviceName,
      ROOT_DOMAIN: this.rootDomain,
      ACCOUNT_ID: this.accountId,
      ZONE_ID: this.zoneId
    };

    try {
      const status = await addsubdomain(env, subdomain);
      if (status.success) {
        await ctx.reply(`✅ Subdomain *${subdomain}.${this.rootDomain}* berhasil ditambahkan ke Cloudflare.`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`⚠️ Gagal menambahkan subdomain: ${status.message}`);
      }
    } catch (error) {
      console.error(error);
      await ctx.reply('❌ Terjadi kesalahan saat menambahkan subdomain.');
    }
  }

  async handleDelete(ctx) {
    const text = ctx.message.text.split(' ');
    if (text.length < 2) {
      await ctx.reply('Masukkan subdomain yang ingin dihapus.\nContoh: /delete mysubdomain');
      return;
    }

    const subdomain = text[1];
    const env = {
      API_KEY: this.apiKey,
      API_EMAIL: this.apiEmail,
      SERVICE_NAME: this.serviceName,
      ROOT_DOMAIN: this.rootDomain,
      ACCOUNT_ID: this.accountId,
      ZONE_ID: this.zoneId
    };

    try {
      const status = await deletesubdomain(env, subdomain);
      if (status.success) {
        await ctx.reply(`✅ Subdomain *${subdomain}.${this.rootDomain}* berhasil dihapus dari Cloudflare.`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`⚠️ Gagal menghapus subdomain: ${status.message}`);
      }
    } catch (error) {
      console.error(error);
      await ctx.reply('❌ Terjadi kesalahan saat menghapus subdomain.');
    }
  }

  async handleList(ctx) {
    const env = {
      API_KEY: this.apiKey,
      API_EMAIL: this.apiEmail,
      SERVICE_NAME: this.serviceName,
      ROOT_DOMAIN: this.rootDomain,
      ACCOUNT_ID: this.accountId,
      ZONE_ID: this.zoneId
    };

    try {
      const result = await listSubdomains(env);
      if (result.success && result.subdomains.length > 0) {
        const list = result.subdomains.map((item, i) => `${i + 1}. ${item}`).join('\n');
        await ctx.reply(`📄 *Daftar Subdomain Tersimpan:*\n\n${list}`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply('ℹ️ Belum ada subdomain yang terdaftar.');
      }
    } catch (error) {
      console.error(error);
      await ctx.reply('❌ Terjadi kesalahan saat mengambil daftar subdomain.');
    }
  }
}
