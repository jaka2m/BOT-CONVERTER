// itil.js

// Data Cloudflare
export const TELEGRAM_BOT_TOKEN = "7791564952:AAHXcZF0NFk512tuUNs7iEzJ12DZpLyOpo4";
export const apiKey = "5fae9fcb9c193ce65de4b57689a94938b708e";
export const accountID = "e9930d5ca683b0461f73477050fee0c7";
export const zoneID = "80423e7547d2fa85e13796a1f41deced";
export const apiEmail = "ambebalong@gmail.com";
export const serviceName = "siren";
export const rootDomain = "joss.checker-ip.xyz";

// GANTI dengan ID pemilik (boleh lebih dari satu)
export const OWNER_IDS = [1467883032, 987654321];

export function isAdmin(userId) {
  return OWNER_IDS.includes(userId);
}

// Wildcards disimpan di memori sementara (non-persistent)
let wildcardsList = [];

export async function readWildcards() {
  return wildcardsList;
}

export async function writeWildcards(list) {
  wildcardsList = list;
}
