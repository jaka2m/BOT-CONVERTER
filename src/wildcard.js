const {
  API_KEY,
  ACCOUNT_ID,
  ZONE_ID,
  API_EMAIL,
  SERVICE_NAME,
} = ENV; // Akan di-inject lewat wrangler environment variables

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'X-Auth-Email': API_EMAIL,
  'X-Auth-Key': API_KEY,
  'Content-Type': 'application/json'
};

export async function getDomainList(rootDomain) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result
      .filter(d => d.service === SERVICE_NAME && d.hostname.endsWith(rootDomain))
      .map(d => d.hostname);
  }
  return [];
}

export async function addsubdomain(subdomain, rootDomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  if (!domain.endsWith(rootDomain)) return 400;

  const registeredDomains = await getDomainList(rootDomain);
  if (registeredDomains.includes(domain)) return 409;

  try {
    const testUrl = `https://${domain.replace(`.${rootDomain}`, '')}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: SERVICE_NAME,
    zone_id: ZONE_ID
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

export async function deletesubdomain(subdomain, rootDomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  const urlList = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`;
  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

export async function listSubdomains(rootDomain) {
  return await getDomainList(rootDomain);
}
