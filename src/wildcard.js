export const headers = (env) => ({
  'Authorization': `Bearer ${env.API_KEY}`,
  'X-Auth-Email': env.API_EMAIL,
  'X-Auth-Key': env.API_KEY,
  'Content-Type': 'application/json'
});

async function getDomainList(env) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const res = await fetch(url, { headers: headers(env) });

  if (res.ok) {
    const json = await res.json();
    // Filter berdasarkan service name
    return {
      success: true,
      subdomains: json.result
        .filter(d => d.service === env.SERVICE_NAME)
        .map(d => d.hostname)
    };
  }

  return { success: false, subdomains: [] };
}

export async function addsubdomain(env, subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  if (!domain.endsWith(env.ROOT_DOMAIN)) return { success: false, message: 'Subdomain tidak valid' };

  const registeredDomainsResult = await getDomainList(env);
  if (!registeredDomainsResult.success) return { success: false, message: 'Gagal mengambil daftar domain' };

  if (registeredDomainsResult.subdomains.includes(domain)) return { success: false, message: 'Subdomain sudah ada' };

  // Cek domain aktif (status 530)
  try {
    const testUrl = `https://${subdomain}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return { success: false, message: 'Subdomain tidak aktif atau error 530' };
  } catch {
    return { success: false, message: 'Gagal mengakses subdomain' };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: env.SERVICE_NAME,
    zone_id: env.ZONE_ID
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(env),
    body: JSON.stringify(body)
  });

  if (res.ok) return { success: true };
  else return { success: false, message: `Gagal menambahkan subdomain, status: ${res.status}` };
}

export async function deletesubdomain(env, subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  const urlList = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const listRes = await fetch(urlList, { headers: headers(env) });

  if (!listRes.ok) return { success: false, message: `Gagal mengambil daftar domain, status: ${listRes.status}` };

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return { success: false, message: 'Subdomain tidak ditemukan' };

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers: headers(env)
  });

  if (res.ok) return { success: true };
  else return { success: false, message: `Gagal menghapus subdomain, status: ${res.status}` };
}

export async function listSubdomains(env) {
  return await getDomainList(env);
}
