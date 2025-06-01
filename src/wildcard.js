export function createWildcardAPI(env) {
  const apiKey = env.CF_API_KEY;
  const accountID = env.CF_ACCOUNT_ID;
  const zoneID = env.CF_ZONE_ID;
  const apiEmail = env.CF_API_EMAIL;
  const serviceName = env.SERVICE_NAME;
  const rootDomain = env.rootDomain;

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

  async function addsubdomain(subdomain) {
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

  async function deletesubdomain(subdomain) {
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

  async function listSubdomains() {
    const domains = await getDomainList();
    return domains;
  }

  // Return object API
  return {
    addsubdomain,
    deletesubdomain,
    listSubdomains
  };
}
