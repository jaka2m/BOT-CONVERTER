export const TELEGRAM_BOT_TOKEN = "7791564952:7664381872:AAHfoMYhaUYlzRgMlydfA3zvwkMyVLMhoTU";
export const apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
export const accountID = "e9930d5ca683b0461f73477050fee0c7";
export const zoneID = "80423e7547d2fa85e13796a1f41deced";
export const apiEmail = "ambebalong@gmail.com";
export const serviceName = "siren";
export const rootDomain = "joss.checker-ip.xyz";

// GANTI dengan ID pemilik (boleh lebih dari satu)
export const OWNER_IDS = [1467883032, 987654321];

// === WILDCARD FILE HANDLING ===
const FILE = './wildcards.txt';

export function isAdmin(userId) {
  return OWNER_IDS.includes(userId);
}

export async function readWildcards() {
  try {
    const data = await fs.readFile(FILE, 'utf8');
    return data.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function writeWildcards(list) {
  await fs.writeFile(FILE, list.join('\n'), 'utf8');
}
