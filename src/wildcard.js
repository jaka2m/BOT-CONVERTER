const headers = {
  'Authorization': `Bearer ${env.API_KEY}`,
  'X-Auth-Email': env.API_EMAIL,
  'X-Auth-Key': env.API_KEY,
  'Content-Type': 'application/json'
};

// Ambil daftar subdomain dari Cloudflare
async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;

  const res = await fetch(url, { headers });
  if (!res.ok) return [];

  const json = await res.json();
  return json.result
    .filter(d => d.service === env.SERVICE_NAME)
    .map(d => d.hostname);
}

// Tambahkan subdomain baru
export async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  // Validasi domain
  if (!domain.endsWith(env.ROOT_DOMAIN)) return 400;

  // Cek apakah sudah terdaftar
  const registeredDomains = await getDomainList();
  if (registeredDomains.includes(domain)) return 409;

  try {
    // Cek apakah domain belum aktif (status 530)
    const testUrl = `https://${domain.replace(`.${env.ROOT_DOMAIN}`, '')}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
  }

  // Tambahkan subdomain ke Cloudflare Workers
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: env.SERVICE_NAME,
    zone_id: env.ZONE_ID
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

// Hapus subdomain yang ada
export async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  // Ambil list untuk mencari ID domain yang sesuai
  const urlList = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  // Hapus subdomain dari Cloudflare Workers
  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

// Ambil daftar subdomain yang aktif
export async function listSubdomains() {
  return await getDomainList();
}
