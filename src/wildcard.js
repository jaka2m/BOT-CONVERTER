const apiKey = Deno.env.get('API_KEY');          // Cloudflare API key
const accountID = Deno.env.get('ACCOUNT_ID');   // Cloudflare Account ID
const zoneID = Deno.env.get('ZONE_ID');         // Zone ID
const apiEmail = Deno.env.get('API_EMAIL');     // API email (kadang optional tergantung token)
const serviceName = Deno.env.get('SERVICE_NAME');
const rootDomainGlobal = Deno.env.get('ROOT_DOMAIN');

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'X-Auth-Email': apiEmail,
  'X-Auth-Key': apiKey,
  'Content-Type': 'application/json'
};

async function getDomainList(rootDomain = rootDomainGlobal) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result
      .filter(d => d.service === serviceName && d.hostname.endsWith(rootDomain))
      .map(d => d.hostname);
  }
  return [];
}

export async function addsubdomain(subdomain, rootDomain = rootDomainGlobal) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  if (!domain.endsWith(rootDomain)) return 400;

  const registeredDomains = await getDomainList(rootDomain);
  if (registeredDomains.includes(domain)) return 409;

  try {
    // Cek apakah domain sudah aktif (cek status 530)
    const testUrl = `https://${subdomain}`;
    const domainTest = await fetch(testUrl);
    if (domainTest.status === 530) return 530;
  } catch {
    return 400;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const body = {
    environment: "production",
    hostname: domain,
    service: serviceName,
    zone_id: zoneID
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  return res.status;
}

export async function deletesubdomain(subdomain, rootDomain = rootDomainGlobal) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  const urlList = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const listRes = await fetch(urlList, { headers });
  if (!listRes.ok) return listRes.status;

  const listJson = await listRes.json();
  const domainObj = listJson.result.find(d => d.hostname === domain);
  if (!domainObj) return 404;

  const urlDelete = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains/${domainObj.id}`;
  const res = await fetch(urlDelete, {
    method: 'DELETE',
    headers
  });

  return res.status;
}

export async function listSubdomains(rootDomain = rootDomainGlobal) {
  const domains = await getDomainList(rootDomain);
  return domains;
}
