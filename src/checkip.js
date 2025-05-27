export async function checkProxyIP(link) {
  try {
    let ip = '';
    let port = '443'; // Default port jika tidak ditentukan

    if (link.includes('://')) {
      // Jika format link URI (misalnya: vless://..., vmess://..., dll)
      const url = new URL(link.trim());
      const hostPart = url.host || url.pathname.split('@').pop().split('#')[0];
      [ip, port = '443'] = hostPart.split(':');
    } else {
      // Jika hanya berupa IP/domain atau IP:port
      const clean = link.trim();
      [ip, port = '443'] = clean.split(':');
    }

    const res = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    const data = await res.json();

    return {
      status: data.status || 'UNKNOWN',
      ip: data.ip || ip,
      port: data.port || port,
      country: data.country || '-',
      flag: data.flag || '',
      city: data.city || '-',
      isp: data.isp || '-',
      delay: data.delay || '-',
      org: data.org || '-',
    };
  } catch (error) {
    return {
      status: 'ERROR',
      ip: '-',
      port: '-',
      country: '-',
      flag: '',
      city: '-',
      isp: '-',
      delay: '-',
      org: '-',
    };
  }
}
