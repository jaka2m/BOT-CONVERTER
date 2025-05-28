// Menggunakan TextDecoder untuk decode base64 di lingkungan CF Workers
function decodeBase64(str) {
  // Alternatif 1: Menggunakan atob (browser API)
  if (typeof atob === 'function') {
    return atob(str);
  }
  
  // Alternatif 2: Implementasi manual base64 decode
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  let char1, char2, char3;
  let enc1, enc2, enc3, enc4;

  // Remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');

  while (i < str.length) {
    enc1 = base64Chars.indexOf(str.charAt(i++));
    enc2 = base64Chars.indexOf(str.charAt(i++));
    enc3 = base64Chars.indexOf(str.charAt(i++));
    enc4 = base64Chars.indexOf(str.charAt(i++));

    char1 = (enc1 << 2) | (enc2 >> 4);
    char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    char3 = ((enc3 & 3) << 6) | enc4;

    result += String.fromCharCode(char1);
    if (enc3 !== 64) result += String.fromCharCode(char2);
    if (enc4 !== 64) result += String.fromCharCode(char3);
  }

  return result;
}

export function parseV2RayLink(link) {
  try {
    if (link.startsWith('vmess://')) {
      const base64 = link.substring(8);
      const decoded = decodeBase64(base64);
      let config;
      
      try {
        config = JSON.parse(decoded);
      } catch (e) {
        // Fallback untuk format non-standard
        const match = decoded.match(/{"v":"\d+".*}/);
        if (match) {
          config = JSON.parse(match[0]);
        } else {
          throw new Error('Format VMess tidak valid');
        }
      }
      
      return {
        type: 'vmess',
        name: config.ps || `VMess-${config.add}:${config.port}`,
        server: config.add,
        port: config.port,
        uuid: config.id,
        alterId: config.aid || 0,
        cipher: config.scy || 'auto',
        tls: config.tls === 'tls',
        skipCertVerify: false,
        network: config.net || 'tcp',
        wsPath: config.path || '',
        wsHost: config.host || config.add,
        sni: config.sni || config.host || config.add
      };
    }

    if (link.startsWith('vless://')) {
      return parseVLESSLink(link);
    }

    if (link.startsWith('trojan://')) {
      return parseTrojanLink(link);
    }

    if (link.startsWith('ss://')) {
      return parseShadowsocksLink(link);
    }

    throw new Error('Unsupported link type');

  } catch (error) {
    console.error(`Failed to parse link: ${link}`, error);
    throw new Error(`Gagal parsing link VMess: ${error.message}`);
  }
}

function parseVLESSLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  
  return {
    type: 'vless',
    name: decodeURIComponent(url.hash.substring(1)),
    server: url.hostname,
    port: parseInt(url.port),
    uuid: url.username,
    tls: params.get('security') === 'tls',
    skipCertVerify: false,
    network: params.get('type') || 'tcp',
    wsPath: params.get('path') || '',
    wsHost: params.get('host') || url.hostname,
    sni: params.get('sni') || params.get('host') || url.hostname
  };
}

function parseTrojanLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  
  return {
    type: 'trojan',
    name: decodeURIComponent(url.hash.substring(1)),
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    tls: params.get('security') === 'tls',
    skipCertVerify: false,
    network: params.get('type') || 'tcp',
    wsPath: params.get('path') || '',
    wsHost: params.get('host') || url.hostname,
    sni: params.get('sni') || params.get('host') || url.hostname
  };
}

function parseShadowsocksLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  
  if (params.get('plugin') === 'v2ray-plugin' || params.get('type') === 'ws') {
    return {
      type: 'ss',
      name: decodeURIComponent(url.hash.substring(1)),
      server: url.hostname,
      port: parseInt(url.port),
      cipher: url.protocol.substring(3) || 'none',
      password: url.username,
      tls: params.get('security') === 'tls',
      skipCertVerify: false,
      network: params.get('type') || 'tcp',
      wsPath: params.get('path') || '',
      wsHost: params.get('host') || url.hostname,
      sni: params.get('sni') || params.get('host') || url.hostname
    };
  }

  throw new Error('Shadowsocks link invalid');
}
