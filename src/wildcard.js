const headers = {
  'Authorization': `Bearer ${env.API_KEY}`,
  'X-Auth-Email': env.API_EMAIL,
  'X-Auth-Key': env.API_KEY,
  'Content-Type': 'application/json'
};

async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result
      .filter(d => d.service === env.SERVICE_NAME)
      .map(d => d.hostname);
  }
  return [];
}

export async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  if (!domain.endsWith(env.ROOT_DOMAIN)) return 400;

  const registeredDomains = await getDomainList();
  if (registeredDomains.includes(domain)) return 409;

  try {
    // Cek apakah domain sudah aktif (cek 530)
    const testUrl = `https://${domain.replace(`.${env.ROOT_DOMAIN}`, '')}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
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
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

export async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${env.ROOT_DOMAIN}`.toLowerCase();

  // Ambil dulu list domain untuk dapat ID domain yang valid
  const urlList = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains`;
  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

// Fungsi baru untuk list subdomain
export async function listSubdomains() {
  const domains = await getDomainList();
  return domains;
}
