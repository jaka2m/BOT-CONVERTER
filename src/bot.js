// bot.js
import { checkProxyIP } from './checkip.js';

export async function handleProxyCheckCommand(link) {
  console.log(`Menerima link proxy: ${link}`);

  const result = await checkProxyIP(link);

  if (result.status === 'ACTIVE') {
    console.log('Proxy aktif, kirim config ke user:');
    console.log(result.configText);
    // TODO: Implementasi kirim pesan balasan ke user bot, misal via Telegram API
  } else if (result.status === 'ERROR') {
    console.log('Terjadi kesalahan saat pengecekan IP.');
    // TODO: Kirim pesan error ke user
  } else {
    console.log('Proxy tidak aktif atau tidak valid.');
    // TODO: Kirim pesan status ke user
  }

  return result;
}
