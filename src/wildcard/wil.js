const apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
const accountID = "e9930d5ca683b0461f73477050fee0c7";
const zoneID = "80423e7547d2fa85e13796a1f41deced";
const apiEmail = "ambebalong@gmail.com";
const serviceName = "siren";
const rootDomain = "joss.checker-ip.xyz";

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'X-Auth-Email': apiEmail,
  'X-Auth-Key': apiKey,
  'Content-Type': 'application/json'
};

async function getDomainList() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const json = await res.json();
    return json.result
      .filter(d => d.service === serviceName)
      .map(d => d.hostname);
  }
  return [];
}

export async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  if (!domain.endsWith(rootDomain)) return 400;

  const registeredDomains = await getDomainList();
  if (registeredDomains.includes(domain)) return 409;

  try {
    // Cek apakah domain sudah aktif (cek 530)
    const testUrl = `https://${domain.replace(`.${rootDomain}`, '')}`;
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

export async function deletesubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  // Ambil dulu list domain untuk dapat ID domain yang valid
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

// Fungsi baru untuk list subdomain
export async function listSubdomains() {
  const domains = await getDomainList();
  return domains;
}
