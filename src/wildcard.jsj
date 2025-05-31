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
    // Kembalikan full objek domain supaya bisa akses id-nya
    return json.result.filter(d => d.service === serviceName);
  }
  return [];
}

export async function addsubdomain(subdomain) {
  const domain = `${subdomain}.${rootDomain}`.toLowerCase();

  if (!domain.endsWith(rootDomain)) return 400;

  const registeredDomains = await getDomainList();
  if (registeredDomains.some(d => d.hostname === domain)) return 409;

  try {
    // Cek apakah domain sudah aktif (cek status 530)
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

  // Dapatkan daftar domain lengkap
  const registeredDomains = await getDomainList();
  // Cari domain berdasarkan hostname
  const targetDomain = registeredDomains.find(d => d.hostname === domain);

  if (!targetDomain) {
    // Domain tidak ditemukan
    return 404;
  }

  // Pakai id domain untuk hapus
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountID}/workers/domains/${targetDomain.id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers
  });

  return res.status;
}
