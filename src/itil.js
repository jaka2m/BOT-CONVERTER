// === KONFIG TELEGRAM & CLOUDFLARE ===
export const TELEGRAM_BOT_TOKEN = "7791564952:AAHXcZF0NFk512tuUNs7iEzJ12DZpLyOpo4";
export const CLOUDFLARE_CONFIG = {
  apiKey: "5fae9fcb9c193ce65de4b57689a94938b708e",
  accountID: "e9930d5ca683b0461f73477050fee0c7",
  zoneID: "80423e7547d2fa85e13796a1f41deced",
  email: "ambebalong@gmail.com",
  serviceName: "siren",
  rootDomain: "joss.checker-ip.xyz"
};
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
