const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/converter/linkParser.js
function decodeBase64(str) {
  if (typeof atob === "function") {
    return atob(str);
  }
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  let char1, char2, char3;
  let enc1, enc2, enc3, enc4;
  str = str.replace(/[^A-Za-z0-9+/=]/g, "");
  while (i < str.length) {
    enc1 = base64Chars.indexOf(str.charAt(i++));
    enc2 = base64Chars.indexOf(str.charAt(i++));
    enc3 = base64Chars.indexOf(str.charAt(i++));
    enc4 = base64Chars.indexOf(str.charAt(i++));
    char1 = enc1 << 2 | enc2 >> 4;
    char2 = (enc2 & 15) << 4 | enc3 >> 2;
    char3 = (enc3 & 3) << 6 | enc4;
    result += String.fromCharCode(char1);
    if (enc3 !== 64) result += String.fromCharCode(char2);
    if (enc4 !== 64) result += String.fromCharCode(char3);
  }
  return result;
}
__name(decodeBase64, "decodeBase64");
function parseV2RayLink(link) {
  try {
    if (link.startsWith("vmess://")) {
      const base64 = link.substring(8);
      const decoded = decodeBase64(base64);
      let config;
      try {
        config = JSON.parse(decoded);
      } catch (e) {
        const match = decoded.match(/{"v":"\d+".*}/);
        if (match) {
          config = JSON.parse(match[0]);
        } else {
          throw new Error("Format VMess tidak valid");
        }
      }
      return {
        type: "vmess",
        name: config.ps || `VMess-${config.add}:${config.port}`,
        server: config.add,
        port: config.port,
        uuid: config.id,
        alterId: config.aid || 0,
        cipher: config.scy || "auto",
        tls: config.tls === "tls",
        skipCertVerify: false,
        network: config.net || "tcp",
        wsPath: config.path || "",
        wsHost: config.host || config.add,
        sni: config.sni || config.host || config.add
      };
    }
    if (link.startsWith("vless://")) {
      return parseVLESSLink(link);
    }
    if (link.startsWith("trojan://")) {
      return parseTrojanLink(link);
    }
    if (link.startsWith("ss://")) {
      return parseShadowsocksLink(link);
    }
    throw new Error("Unsupported link type");
  } catch (error) {
    console.error(`Failed to parse link: ${link}`, error);
    throw new Error(`Gagal parsing link VMess: ${error.message}`);
  }
}
__name(parseV2RayLink, "parseV2RayLink");
function parseVLESSLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  return {
    type: "vless",
    name: decodeURIComponent(url.hash.substring(1)),
    server: url.hostname,
    port: parseInt(url.port),
    uuid: url.username,
    tls: params.get("security") === "tls",
    skipCertVerify: false,
    network: params.get("type") || "tcp",
    wsPath: params.get("path") || "",
    wsHost: params.get("host") || url.hostname,
    sni: params.get("sni") || params.get("host") || url.hostname
  };
}
__name(parseVLESSLink, "parseVLESSLink");
function parseTrojanLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  return {
    type: "trojan",
    name: decodeURIComponent(url.hash.substring(1)),
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    tls: params.get("security") === "tls",
    skipCertVerify: false,
    network: params.get("type") || "tcp",
    wsPath: params.get("path") || "",
    wsHost: params.get("host") || url.hostname,
    sni: params.get("sni") || params.get("host") || url.hostname
  };
}
__name(parseTrojanLink, "parseTrojanLink");
function parseShadowsocksLink(link) {
  const url = new URL(link);
  const params = new URLSearchParams(url.search);
  if (params.get("plugin") === "v2ray-plugin" || params.get("type") === "ws") {
    return {
      type: "ss",
      name: decodeURIComponent(url.hash.substring(1)),
      server: url.hostname,
      port: parseInt(url.port),
      cipher: url.protocol.substring(3) || "none",
      password: url.username,
      tls: params.get("security") === "tls",
      skipCertVerify: false,
      network: params.get("type") || "tcp",
      wsPath: params.get("path") || "",
      wsHost: params.get("host") || url.hostname,
      sni: params.get("sni") || params.get("host") || url.hostname
    };
  }
  throw new Error("Shadowsocks link invalid");
}
__name(parseShadowsocksLink, "parseShadowsocksLink");

// src/converter/configGenerators.js
function generateClashConfig(links, isFullConfig = false) {
  const parsedLinks = links.map((link) => parseV2RayLink(link));
  let config = `# Clash Configuration
# Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}

`;
  if (isFullConfig) {
    config += `port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: redir-host
  nameserver:
    - 8.8.8.8
    - https://dns.google/dns-query
  fallback:
    - 8.8.4.4
    - https://dns.google/dns-query

rule-providers:
   ADS:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_basicads.yaml"
    path: "./rule_provider/rule_basicads.yaml"
    interval: 86400

   Porn:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_porn.yaml"
    path: "./rule_provider/rule_porn.yaml"
    interval: 86400

`;
  }
  config += `proxies:
`;
  parsedLinks.forEach((link) => {
    config += `  - name: "${link.name}"
`;
    config += `    type: ${link.type}
`;
    config += `    server: ${link.server}
`;
    config += `    port: ${link.port}
`;
    if (link.type === "vmess") {
      config += `    uuid: ${link.uuid}
`;
      config += `    alterId: ${link.alterId}
`;
      config += `    cipher: ${link.cipher}
`;
    } else if (link.type === "vless") {
      config += `    uuid: ${link.uuid}
`;
    } else if (link.type === "trojan") {
      config += `    password: ${link.password}
`;
    } else if (link.type === "ss") {
      config += `    cipher: ${link.cipher}
`;
      config += `    password: ${link.password}
`;
    }
    config += `    udp: true
`;
    if (link.tls) {
      config += `    tls: true
`;
      config += `    skip-cert-verify: ${link.skipCertVerify}
`;
      if (link.sni) {
        config += `    servername: ${link.sni}
`;
      }
    }
    if (link.network === "ws") {
      config += `    network: ws
`;
      config += `    ws-opts:
`;
      config += `      path: "${link.wsPath}"
`;
      if (link.wsHost) {
        config += `      headers:
`;
        config += `        Host: "${link.wsHost}"
`;
      }
    }
    config += "\n";
  });
  if (isFullConfig) {
    config += `proxy-groups:
  - name: "INTERNET"
    type: select
    proxies:
      - "BALANCED"
      - "SELECTOR"
      - "BEST-PING"
      - "DIRECT"
      - "REJECT"

  - name: "SELECTOR"
    type: select
    proxies:
      - "DIRECT"
      - "REJECT"
`;
    parsedLinks.forEach((link) => {
      config += `      - "${link.name}"
`;
    });
    config += `
  - name: "BEST-PING"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:
`;
    parsedLinks.forEach((link) => {
      config += `      - "${link.name}"
`;
    });
    config += `
  - name: "BALANCED"
    type: load-balance
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:
`;
    parsedLinks.forEach((link) => {
      config += `      - "${link.name}"
`;
    });
    config += `
  - name: "PORN"
    type: select
    proxies:
      - "REJECT"
      - "SELECTOR"

  - name: "ADS"
    type: select
    proxies:
      - "REJECT"
      - "SELECTOR"

rules:
  - RULE-SET, ADS,ADS
  - RULE-SET, Porn,PORN
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - MATCH,INTERNET
`;
  }
  return config;
}
__name(generateClashConfig, "generateClashConfig");
function generateNekoboxConfig(links, isFullConfig = false) {
  const parsedLinks = links.map((link) => parseV2RayLink(link));
  let config = isFullConfig ? `{
  "dns": {
    "final": "dns-final",
    "independent_cache": true,
    "rules": [
      {
        "disable_cache": false,
        "domain": [
          "family.cloudflare-dns.com"
        ],
        "server": "direct-dns"
      }
    ],
    "servers": [
      {
        "address": "https://family.cloudflare-dns.com/dns-query",
        "address_resolver": "direct-dns",
        "strategy": "ipv4_only",
        "tag": "remote-dns"
      },
      {
        "address": "local",
        "strategy": "ipv4_only",
        "tag": "direct-dns"
      },
      {
        "address": "local",
        "address_resolver": "dns-local",
        "strategy": "ipv4_only",
        "tag": "dns-final"
      },
      {
        "address": "local",
        "tag": "dns-local"
      },
      {
        "address": "rcode://success",
        "tag": "dns-block"
      }
    ]
  },
  "experimental": {
    "cache_file": {
      "enabled": true,
      "path": "../cache/clash.db",
      "store_fakeip": true
    },
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "../files/yacd"
    }
  },
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "listen_port": 6450,
      "override_address": "8.8.8.8",
      "override_port": 53,
      "tag": "dns-in",
      "type": "direct"
    },
    {
      "domain_strategy": "",
      "endpoint_independent_nat": true,
      "inet4_address": [
        "172.19.0.1/28"
      ],
      "mtu": 9000,
      "sniff": true,
      "sniff_override_destination": true,
      "stack": "system",
      "tag": "tun-in",
      "type": "tun"
    },
    {
      "domain_strategy": "",
      "listen": "0.0.0.0",
      "listen_port": 2080,
      "sniff": true,
      "sniff_override_destination": true,
      "tag": "mixed-in",
      "type": "mixed"
    }
  ],
  "log": {
    "level": "info"
  },
  "outbounds": [
    {
      "tag": "Internet",
      "type": "selector",
      "outbounds": [
        "Best Latency",
` : `{
  "outbounds": [
`;
  parsedLinks.forEach((link) => {
    config += `        "${link.name}",
`;
  });
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [
`;
    parsedLinks.forEach((link) => {
      config += `        "${link.name}",
`;
    });
    config += `        "direct"
      ],
      "url": "https://detectportal.firefox.com/success.txt",
      "interval": "1m0s"
    },
`;
  }
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ",\n";
    config += `    {
`;
    config += `      "tag": "${link.name}",
`;
    if (link.type === "vmess") {
      config += `      "type": "vmess",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "uuid": "${link.uuid}",
`;
      config += `      "alter_id": ${link.alterId || 0},
`;
      config += `      "security": "${link.cipher || "auto"}",
`;
      config += `      "packet_encoding": "xudp",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "vless") {
      config += `      "type": "vless",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "uuid": "${link.uuid}",
`;
      config += `      "flow": "",
`;
      config += `      "packet_encoding": "xudp",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "trojan") {
      config += `      "type": "trojan",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "password": "${link.password}",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "ss") {
      config += `      "type": "shadowsocks",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "method": "${link.cipher || "none"}",
`;
      config += `      "password": "${link.password}",
`;
      config += `      "plugin": "v2ray-plugin",
`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"
`;
    }
    config += `    }`;
  });
  if (isFullConfig) {
    config += `,
    {
      "tag": "direct",
      "type": "direct"
    },
    {
      "tag": "bypass",
      "type": "direct"
    },
    {
      "tag": "block",
      "type": "block"
    },
    {
      "tag": "dns-out",
      "type": "dns"
    }
  ],
  "route": {
    "auto_detect_interface": true,
    "rules": [
      {
        "outbound": "dns-out",
        "port": [
          53
        ]
      },
      {
        "inbound": [
          "dns-in"
        ],
        "outbound": "dns-out"
      },
      {
        "network": [
          "udp"
        ],
        "outbound": "block",
        "port": [
          443
        ],
        "port_range": []
      },
      {
        "ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "outbound": "block",
        "source_ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ]
      }
    ]
  }
}`;
  } else {
    config += `
  ]
}`;
  }
  return config;
}
__name(generateNekoboxConfig, "generateNekoboxConfig");
function generateSingboxConfig(links, isFullConfig = false) {
  const parsedLinks = links.map((link) => parseV2RayLink(link));
  let config = isFullConfig ? `{
  "log": {
    "level": "info"
  },
  "dns": {
    "servers": [
      {
        "tag": "remote-dns",
        "address": "https://8.8.8.8/dns-query",
        "address_resolver": "direct-dns",
        "strategy": "ipv4_only"
      },
      {
        "tag": "direct-dns",
        "address": "local",
        "strategy": "ipv4_only"
      },
      {
        "tag": "dns-final",
        "address": "local",
        "address_resolver": "dns-local",
        "strategy": "ipv4_only"
      },
      {
        "tag": "dns-local",
        "address": "local"
      },
      {
        "tag": "dns-block",
        "address": "rcode://success"
      }
    ],
    "rules": [
      {
        "domain": [
          "8.8.8.8"
        ],
        "server": "direct-dns"
      }
    ],
    "final": "dns-final",
    "independent_cache": true
  },
  "inbounds": [
    {
      "type": "tun",
      "mtu": 1400,
      "inet4_address": "172.19.0.1/30",
      "inet6_address": "fdfe:dcba:9876::1/126",
      "auto_route": true,
      "strict_route": true,
      "endpoint_independent_nat": true,
      "stack": "mixed",
      "sniff": true
    }
  ],
  "outbounds": [
    {
      "tag": "Internet",
      "type": "selector",
      "outbounds": [
        "Best Latency",
` : `{
  "outbounds": [
`;
  parsedLinks.forEach((link) => {
    config += `        "${link.name}",
`;
  });
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [
`;
    parsedLinks.forEach((link) => {
      config += `        "${link.name}",
`;
    });
    config += `        "direct"
      ],
      "url": "https://www.google.com",
      "interval": "10s"
    },
`;
  }
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ",\n";
    config += `    {
`;
    config += `      "tag": "${link.name}",
`;
    if (link.type === "vmess") {
      config += `      "type": "vmess",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "uuid": "${link.uuid}",
`;
      config += `      "alter_id": ${link.alterId || 0},
`;
      config += `      "security": "${link.cipher || "zero"}",
`;
      config += `      "packet_encoding": "xudp",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "vless") {
      config += `      "type": "vless",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "uuid": "${link.uuid}",
`;
      config += `      "packet_encoding": "xudp",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "trojan") {
      config += `      "type": "trojan",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "password": "${link.password}",
`;
      config += `      "domain_strategy": "ipv4_only",
`;
      if (link.tls) {
        config += `      "tls": {
`;
        config += `        "enabled": true,
`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",
`;
        config += `        "insecure": ${link.skipCertVerify},
`;
        config += `        "utls": {
`;
        config += `          "enabled": true,
`;
        config += `          "fingerprint": "randomized"
`;
        config += `        }
`;
        config += `      },
`;
      }
      if (link.network === "ws") {
        config += `      "transport": {
`;
        config += `        "type": "ws",
`;
        config += `        "path": "${link.wsPath}",
`;
        config += `        "headers": {
`;
        config += `          "Host": "${link.wsHost || link.server}"
`;
        config += `        },
`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"
`;
        config += `      },
`;
      }
      config += `      "multiplex": {
`;
      config += `        "enabled": false,
`;
      config += `        "protocol": "smux",
`;
      config += `        "max_streams": 32
`;
      config += `      }
`;
    } else if (link.type === "ss") {
      config += `      "type": "shadowsocks",
`;
      config += `      "server": "${link.server}",
`;
      config += `      "server_port": ${link.port},
`;
      config += `      "method": "${link.cipher || "none"}",
`;
      config += `      "password": "${link.password}",
`;
      config += `      "plugin": "v2ray-plugin",
`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"
`;
    }
    config += `    }`;
  });
  if (isFullConfig) {
    config += `,
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "direct",
      "tag": "bypass"
    },
    {
      "type": "block",
      "tag": "block"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    }
  ],
  "route": {
    "rules": [
      {
        "port": 53,
        "outbound": "dns-out"
      },
      {
        "inbound": "dns-in",
        "outbound": "dns-out"
      },
      {
        "network": "udp",
        "port": 443,
        "outbound": "block"
      },
      {
        "source_ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "outbound": "block"
      }
    ],
    "auto_detect_interface": true
  },
  "experimental": {
    "cache_file": {
      "enabled": false
    },
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "ui",
      "external_ui_download_url": "https://github.com/MetaCubeX/metacubexd/archive/gh-pages.zip",
      "external_ui_download_detour": "Internet",
      "secret": "stupid",
      "default_mode": "rule"
    }
  }
}`;
  } else {
    config += `
  ]
}`;
  }
  return config;
}
__name(generateSingboxConfig, "generateSingboxConfig");

// src/converter/converter.js
const Converterbot = class {
  static {
    __name(this, "Converterbot");
  }
  constructor(token, apiUrl, ownerId, env) {
    this.token = token;
    this.apiUrl = apiUrl || "https://api.telegram.org";
    this.ownerId = ownerId;
    this.env = env;
  }

  async handleUpdate(update, ctx) {
    // Handle pagination callback
    if (update.callback_query && update.callback_query.data.startsWith("userlist_page_")) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const page = parseInt(update.callback_query.data.split("_")[2], 10);
      const allUsers = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
      const totalUsers = allUsers.length;
      const pageSize = 10;
      const totalPages = Math.ceil(totalUsers / pageSize);
      const start = page * pageSize;
      const end = start + pageSize;
      const pageUsers = allUsers.slice(start, end);
      
      // Format daftar pengguna sesuai gaya yang diminta
      const userListText = pageUsers.map((user, index) => {
        const userNumber = start + index + 1;
        const userId = typeof user === "object" && user.id ? user.id : user;
        const username = typeof user === "object" ? user.username : null;
        
        // Fungsi untuk melepaskan karakter Markdown
        const escapeMarkdown = (text) => {
          if (text === null || typeof text === 'undefined') {
            return '';
          }
          return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        };
        
        let userLine = `👤 **${userNumber}.**`;
        if (username && username !== "N/A") {
          userLine += ` ${escapeMarkdown(username)}`;
        }
        const idLine = `🆔 ID: \`${userId}\``;
        return `${userLine}\n${idLine}`;
      }).join("\n\n");

      // Format message dengan border dan layout yang lebih rapi
      const messageText = `🎯 **DAFTAR PENGGUNA**\n
╔═══════════════════╗
📊 **Total:** ${totalUsers} pengguna
📄 **Halaman:** ${page + 1}/${totalPages}
╚═══════════════════╝

${userListText}`;

      // Keyboard dengan emoji yang lebih variatif
      const keyboard = [];
      const row = [];
      
      if (page > 0) {
        row.push({ text: "⬅️ Prev", callback_data: `userlist_page_${page - 1}` });
      }
      if (page < totalPages - 1) {
        row.push({ text: "Next ➡️", callback_data: `userlist_page_${page + 1}` });
      }
      
      if (row.length > 0) {
        keyboard.push(row);
      }

      // Hanya tombol refresh saja
      keyboard.push([
        { text: "🔄 Refresh", callback_data: `userlist_page_0` }
      ]);

      await this.editMessageText(chatId, messageId, messageText, {
        reply_markup: {
          inline_keyboard: keyboard
        },
        parse_mode: "Markdown"
      });
      
      await this.answerCallbackQuery(update.callback_query.id);
      return new Response("OK", { status: 200 });
    }

    // Handle refresh callback (kembali ke halaman 0)
    if (update.callback_query && update.callback_query.data === "userlist_page_0") {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const page = 0;
      const allUsers = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
      const totalUsers = allUsers.length;
      const pageSize = 10;
      const totalPages = Math.ceil(totalUsers / pageSize);
      const start = page * pageSize;
      const end = start + pageSize;
      const pageUsers = allUsers.slice(start, end);
      
      const userListText = pageUsers.map((user, index) => {
        const userNumber = start + index + 1;
        const userId = typeof user === "object" && user.id ? user.id : user;
        const username = typeof user === "object" ? user.username : null;
        
        // Fungsi untuk melepaskan karakter Markdown
        const escapeMarkdown = (text) => {
          if (text === null || typeof text === 'undefined') {
            return '';
          }
          return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        };
        
        let userLine = `👤 **${userNumber}.**`;
        if (username && username !== "N/A") {
          userLine += ` ${escapeMarkdown(username)}`;
        }
        const idLine = `🆔 ID: \`${userId}\``;
        return `${userLine}\n${idLine}`;
      }).join("\n\n");

      const messageText = `🎯 **DAFTAR PENGGUNA**\n
╔═══════════════════╗
📊 **Total:** ${totalUsers} pengguna
📄 **Halaman:** ${page + 1}/${totalPages}
╚═══════════════════╝

${userListText}`;

      const keyboard = [];
      const row = [];
      
      if (page > 0) {
        row.push({ text: "⬅️ Prev", callback_data: `userlist_page_${page - 1}` });
      }
      if (page < totalPages - 1) {
        row.push({ text: "Next ➡️", callback_data: `userlist_page_${page + 1}` });
      }
      
      if (row.length > 0) {
        keyboard.push(row);
      }

      keyboard.push([
        { text: "🔄 Refresh", callback_data: `userlist_page_0` }
      ]);

      await this.editMessageText(chatId, messageId, messageText, {
        reply_markup: {
          inline_keyboard: keyboard
        },
        parse_mode: "Markdown"
      });
      
      await this.answerCallbackQuery(update.callback_query.id);
      return new Response("OK", { status: 200 });
    }

    if (!update.message) return new Response("OK", { status: 200 });
    
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const messageId = update.message.message_id;
    const message_thread_id = update.message.message_thread_id;

    const options = message_thread_id ? { message_thread_id } : {};

    // Handle broadcast command
    if (text.startsWith("/broadcast") && chatId.toString() === this.ownerId.toString()) {
      const reply = update.message.reply_to_message;
      const caption = text.substring("/broadcast".length).trim();

      if (reply && reply.photo) {
        const photoId = reply.photo[reply.photo.length - 1].file_id;
        await this.sendBroadcastPhoto(photoId, caption, options);
      } else if (reply && reply.video) {
        const videoId = reply.video.file_id;
        await this.sendBroadcastVideo(videoId, caption, options);
      } else {
        const broadcastMessage = text.substring("/broadcast ".length).trim();
        if (broadcastMessage) {
          await this.sendBroadcastMessage(broadcastMessage, options);
        } else {
          await this.sendMessage(chatId, "📢 **Cara Penggunaan Broadcast:**\n\n`/broadcast Pesan yang ingin Anda siarkan.`\n\n💡 *Contoh:* `/broadcast Halo semua! Ini pesan broadcast.`\n\n🖼️ **Untuk mengirim media:** Balas gambar atau video dengan `/broadcast [keterangan]`.", options);
        }
      }
      return new Response("OK", { status: 200 });
    }
    
    // Handle userlist command
    if (text.startsWith("/userlist")) {
      // Loading message dengan emoji yang lebih menarik
      const loadingMessage = await this.sendMessage(chatId, "⏳ *Memuat daftar pengguna...*", { parse_mode: "Markdown", ...options });
      let messageIdToDelete;
      
      if (loadingMessage && loadingMessage.result) {
        messageIdToDelete = loadingMessage.result.message_id;
      }

      try {
        const allUsers = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
        const totalUsers = allUsers.length;
        
        if (totalUsers === 0) {
          await this.sendMessage(chatId, "📭 *Belum ada pengguna yang terdaftar.*\n\n💡 *Pengguna akan otomatis terdaftar ketika berinteraksi dengan bot.*", { parse_mode: "Markdown", ...options });
          return new Response("OK", { status: 200 });
        }
        
        const pageSize = 10;
        const totalPages = Math.ceil(totalUsers / pageSize);
        const page = 0;
        const start = page * pageSize;
        const end = start + pageSize;
        const pageUsers = allUsers.slice(start, end);
        
        // Format daftar pengguna sesuai gaya yang diminta
        const userListText = pageUsers.map((user, index) => {
          const userNumber = start + index + 1;
          const userId = typeof user === "object" ? user.id : user;
          const username = typeof user === "object" ? user.username : null;
          
          // Fungsi untuk melepaskan karakter Markdown
          const escapeMarkdown = (text) => {
            if (text === null || typeof text === 'undefined') {
              return '';
            }
            return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
          };
          
          let userLine = `👤 **${userNumber}.**`;
          if (username && username !== "N/A") {
            userLine += ` ${escapeMarkdown(username)}`;
          }
          const idLine = `🆔 ID: \`${userId}\``;
          return `${userLine}\n${idLine}`;
        }).join("\n\n");

        // Message dengan layout yang lebih profesional
        const messageText = `🎯 **DAFTAR PENGGUNA**\n
╔═══════════════════╗
📊 **Total:** ${totalUsers} pengguna
📄 **Halaman:** ${page + 1}/${totalPages}
╚═══════════════════╝

${userListText}`;

        // Keyboard dengan styling yang lebih baik
        const keyboard = [];
        const row = [];
        
        if (page > 0) {
          row.push({ text: "⬅️ Prev", callback_data: `userlist_page_${page - 1}` });
        }
        if (page < totalPages - 1) {
          row.push({ text: "Next ➡️", callback_data: `userlist_page_${page + 1}` });
        }
        
        if (row.length > 0) {
          keyboard.push(row);
        }

        // Hanya tombol refresh saja
        keyboard.push([
          { text: "🔄 Refresh", callback_data: `userlist_page_0` }
        ]);

        await this.sendMessage(chatId, messageText, {
          reply_markup: {
            inline_keyboard: keyboard
          },
          parse_mode: "Markdown",
          ...options
        });
        
      } finally {
        if (messageIdToDelete) {
          await this.deleteMessage(chatId, messageIdToDelete);
        }
      }
      return new Response("OK", { status: 200 });
    }
  
    if (text.startsWith("/converter")) {
  await this.sendMessage(
    chatId,
    `🔄 *Konverter Konfigurasi Geo Project Bot*

📩 **Kirimkan link konfigurasi V2Ray** dan saya akan mengubahnya ke berbagai format yang tersedia.

📋 **Format yang didukung:**
• VLESS: \`vless://...\`
• VMess: \`vmess://...\`
• Trojan: \`trojan://...\`
• Shadowsocks: \`ss://...\`

⚡ **Hasil konversi:**
✅ Singbox
✅ Nekobox  
✅ Clash

📝 **Catatan penting:**
• Maksimal 10 link per permintaan
• Disarankan menggunakan *Singbox versi 1.10.3* atau *1.11.8*
• Proses konversi otomatis dan cepat

🚀 **Cara penggunaan:**
Kirim langsung link konfigurasi Anda di chat ini!`,
    { 
      reply_to_message_id: messageId,
      parse_mode: "Markdown",
      ...options
    }
  );
  return new Response("OK", { status: 200 });
}

if (text.includes("://")) {
  try {
    const links = text.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("://"))
      .slice(0, 10);
    
    if (links.length === 0) {
      await this.sendMessage(
        chatId, 
        "❌ *Tidak ada link valid yang ditemukan!*\n\nSilakan kirim link dengan format:\n• VLESS: \\`vless://...\\`\n• VMess: \\`vmess://...\\`\n• Trojan: \\`trojan://...\\`\n• Shadowsocks: \\`ss://...\\`",
        { 
          reply_to_message_id: messageId,
          parse_mode: "Markdown",
          ...options
        }
      );
      return new Response("OK", { status: 200 });
    }

    // Menampilkan pesan proses
    await this.sendMessage(
      chatId,
      `🔄 *Memproses ${links.length} link...*\n⏳ Mohon tunggu sebentar...`,
      { 
        reply_to_message_id: messageId,
        parse_mode: "Markdown",
        ...options
      }
    );

    const clashConfig = generateClashConfig(links, true);
    const nekoboxConfig = generateNekoboxConfig(links, true);
    const singboxConfig = generateSingboxConfig(links, true);

    // Kirim file konfigurasi
    await this.sendDocument(chatId, clashConfig, "config_clash.yaml", "text/yaml", { 
      reply_to_message_id: messageId,
      caption: "⚡ *Konfigurasi Clash*",
      ...options
    });
    
    await this.sendDocument(chatId, nekoboxConfig, "config_nekobox.json", "application/json", { 
      reply_to_message_id: messageId,
      caption: "📱 *Konfigurasi Nekobox*",
      ...options
    });
    
    await this.sendDocument(chatId, singboxConfig, "config_singbox.json", "application/json", { 
      reply_to_message_id: messageId,
      caption: "🎯 *Konfigurasi Singbox*",
      ...options
    });

    // Pesan sukses
    await this.sendMessage(
      chatId,
      `✅ *Konversi Berhasil!*\n\n📦 **${links.length} link** telah dikonversi ke 3 format berbeda:\n\n• 🎯 Singbox\n• 📱 Nekobox\n• ⚡ Clash\n\n🚀 **Selamat menikmati!**`,
      { 
        reply_to_message_id: messageId,
        parse_mode: "Markdown",
        ...options
      }
    );

  } catch (error) {
    console.error("Error processing links:", error);
    await this.sendMessage(
      chatId, 
      `❌ *Terjadi Kesalahan!*\n\nError: ${error.message}\n\nPastikan link yang dikirim dalam format yang benar dan coba lagi.`,
      { 
        reply_to_message_id: messageId,
        parse_mode: "Markdown",
        ...options
      }
    );
  }
}
return new Response("OK", { status: 200 });
    }
    
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async sendVideo(chatId, video, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendVideo`;
    const body = {
      chat_id: chatId,
      video,
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append("document", blob, filename);
    formData.append("chat_id", String(chatId));
    if (options.message_thread_id) {
      formData.append("message_thread_id", String(options.message_thread_id));
    }
    if (options.caption) {
      formData.append("caption", options.caption);
    }
    if (options.parse_mode) {
      formData.append("parse_mode", options.parse_mode);
    }
    if (options.reply_to_message_id) {
      formData.append("reply_to_message_id", String(options.reply_to_message_id));
    }
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: "POST",
      body: formData
    });
    return response.json();
  }
  async sendPhoto(chatId, photo, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendPhoto`;
    const body = {
      chat_id: chatId,
      photo,
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async answerCallbackQuery(callbackQueryId, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId, ...options };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async sendBroadcastMessage(message, options) {
    const userChats = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
    let successCount = 0;
    let failCount = 0;
    const updatedUsers = [];
    for (const user of userChats) {
      const chatId = typeof user === "object" ? user.id : user;
      const username = typeof user === "object" ? user.username : null;
      try {
        const sendOptions = {};
        if (username === "auto_sc") {
          sendOptions.message_thread_id = 1876;
        }
        const response = await this.sendMessage(chatId, message, sendOptions);
        if (response.ok) {
          successCount++;
          updatedUsers.push(user);
        } else {
          failCount++;
          console.error(`Gagal mengirim pesan ke ${chatId}: ${response.description}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Gagal mengirim pesan ke ${chatId}:`, error);
        failCount++;
      }
    }
    await this.env.GEO_DB.put("broadcast_users", JSON.stringify(updatedUsers));
    const totalUsers = updatedUsers.length;
    const broadcastReport = `Pesan broadcast telah dikirimkan.

Total user terdaftar: *${totalUsers}*
Berhasil dikirim: *${successCount}*
Gagal dikirim: *${failCount}*`;
    await this.sendMessage(this.ownerId, broadcastReport, options);
  }

  async sendBroadcastVideo(videoId, caption, options) {
    const userChats = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
    let successCount = 0;
    let failCount = 0;
    const updatedUsers = [];
    for (const user of userChats) {
      const chatId = typeof user === "object" ? user.id : user;
      const username = typeof user === "object" ? user.username : null;
      try {
        const sendOptions = { caption };
        if (username === "auto_sc") {
          sendOptions.message_thread_id = 1876;
        }
        const response = await this.sendVideo(chatId, videoId, sendOptions);
        if (response.ok) {
          successCount++;
          updatedUsers.push(user);
        } else {
          failCount++;
          console.error(`Gagal mengirim video ke ${chatId}: ${response.description}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Gagal mengirim video ke ${chatId}:`, error);
        failCount++;
      }
    }
    await this.env.GEO_DB.put("broadcast_users", JSON.stringify(updatedUsers));
    const totalUsers = updatedUsers.length;
    const broadcastReport = `Siaran video telah dikirim.

Total user terdaftar: *${totalUsers}*
Berhasil dikirim: *${successCount}*
Gagal dikirim: *${failCount}*`;
    await this.sendMessage(this.ownerId, broadcastReport, options);
  }

  async sendBroadcastPhoto(photoId, caption, options) {
    const userChats = await this.env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
    let successCount = 0;
    let failCount = 0;
    const updatedUsers = [];
    for (const user of userChats) {
      const chatId = typeof user === "object" ? user.id : user;
      const username = typeof user === "object" ? user.username : null;
      try {
        const sendOptions = { caption };
        if (username === "auto_sc") {
          sendOptions.message_thread_id = 1876;
        }
        const response = await this.sendPhoto(chatId, photoId, sendOptions);
        if (response.ok) {
          successCount++;
          updatedUsers.push(user);
        } else {
          failCount++;
          console.error(`Gagal mengirim foto ke ${chatId}: ${response.description}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Gagal mengirim foto ke ${chatId}:`, error);
        failCount++;
      }
    }
    await this.env.GEO_DB.put("broadcast_users", JSON.stringify(updatedUsers));
    const totalUsers = updatedUsers.length;
    const broadcastReport = `Siaran foto telah dikirim.

Total user terdaftar: *${totalUsers}*
Berhasil dikirim: *${successCount}*
Gagal dikirim: *${failCount}*`;
    await this.sendMessage(this.ownerId, broadcastReport, options);
  }
};

// src/randomconfig.js
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
__name(generateUUID, "generateUUID");
async function randomconfig(globalBot) {
  try {
    const HOSTKU2 = globalBot.getRandomHost();
    const GITHUB_BASE_URL = "https://raw.githubusercontent.com/jaka2m/botak/main/cek/";
    const proxyResponse = await fetch(`${GITHUB_BASE_URL}proxyList.txt`);
    if (!proxyResponse.ok) {
      return " Gagal mengambil daftar proxy.";
    }
    const ipText = await proxyResponse.text();
    const ipLines = ipText.split("\n").filter((line) => line.trim() !== "");
    if (ipLines.length === 0) {
      return " Daftar proxy kosong atau tidak valid.";
    }
    const randomIndex = Math.floor(Math.random() * ipLines.length);
    const randomProxyLine = ipLines[randomIndex];
    const sequenceNumber = randomIndex + 1;
    const [ip, port, country, provider] = randomProxyLine.split(",");
    if (!ip || !port) {
      return " Data IP atau Port tidak lengkap dari daftar proxy.";
    }
    const checkResponse = await fetch(`https://geovpn.vercel.app/check?ip=${ip}:${port}`);
    if (!checkResponse.ok) {
      return ` Gagal cek status IP ${ip}:${port}.`;
    }
    const data = await checkResponse.json();
    if (data.status?.toUpperCase() !== "ACTIVE") {
      return ` IP ${ip}:${port} tidak aktif.`;
    }
    const pathIPPORT = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;
    const pathCD = `/Free-VPN-CF-Geo-Project/${data.countryCode}${sequenceNumber}`;
    const toBase642 = /* @__PURE__ */ __name((str) => {
      if (typeof btoa === "function") {
        return btoa(unescape(encodeURIComponent(str)));
      } else if (typeof Buffer !== "undefined") {
        return Buffer.from(str, "utf-8").toString("base64");
      } else {
        return encodeURIComponent(str);
      }
    }, "toBase64");
    const infoMessage = `
IP      : ${data.ip}
PORT    : ${data.port}
ISP     : ${data.isp}
COUNTRY : ${data.country}
DELAY   : ${data.delay}
STATUS  : ${data.status}
`;
    const vlessUUID = generateUUID();
    const trojanUUID = generateUUID();
    const ssPassword = generateUUID();
    const vlessTLSLink1 = `vless://${vlessUUID}@${HOSTKU2}:443?encryption=none&security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathIPPORT)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const trojanTLSLink1 = `trojan://${trojanUUID}@${HOSTKU2}:443?security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathIPPORT)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const ssTLSLink1 = `ss://${toBase642(`none:${ssPassword}`)}@${HOSTKU2}:443?encryption=none&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathIPPORT)}&security=tls&sni=${HOSTKU2}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const vlessTLSLink2 = `vless://${vlessUUID}@${HOSTKU2}:443?encryption=none&security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathCD)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const trojanTLSLink2 = `trojan://${trojanUUID}@${HOSTKU2}:443?security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathCD)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const ssTLSLink2 = `ss://${toBase642(`none:${ssPassword}`)}@${HOSTKU2}:443?encryption=none&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(pathCD)}&security=tls&sni=${HOSTKU2}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;
    const configText = `
\`\`\`INFORMATION
${infoMessage}
\`\`\`
\`\`\`VLESS-TLS
${vlessTLSLink1}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLink1}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLink1}
\`\`\`

(Country Code Path : ${data.countryCode}${sequenceNumber})

\`\`\`VLESS-TLS
${vlessTLSLink2}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLink2}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLink2}
\`\`\`

 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    return configText;
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    return ` Terjadi kesalahan: ${error.message}`;
  }
}
__name(randomconfig, "randomconfig");

// src/config.js
async function rotateconfig(chatId, text, options, globalBot) {
  const command = text.trim();
  const args = command.split(" ");
  if (args.length !== 2) {
    await this.sendMessage(chatId, ` *Format salah! Gunakan contoh berikut:*
\`/rotate id\``, {
      parse_mode: "Markdown",
      ...options
    });
    return;
  }
  const countryCode = args[1].toLowerCase();
  const validCountries = [
    "id",
    "sg",
    "my",
    "us",
    "ca",
    "in",
    "gb",
    "ir",
    "ae",
    "fi",
    "tr",
    "md",
    "tw",
    "ch",
    "se",
    "nl",
    "es",
    "ru",
    "ro",
    "pl",
    "al",
    "nz",
    "mx",
    "it",
    "de",
    "fr",
    "am",
    "cy",
    "dk",
    "br",
    "kr",
    "vn",
    "th",
    "hk",
    "cn",
    "jp"
  ];
  if (!validCountries.includes(countryCode)) {
    await this.sendMessage(chatId, ` *Kode negara tidak valid! Gunakan kode yang tersedia.*`, {
      parse_mode: "Markdown",
      ...options
    });
    return;
  }
  const loadingMessage = await this.sendMessage(chatId, "  Sedang memproses config...", options);
  try {
    const response = await fetch("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
    const ipText = await response.text();
    const ipList = ipText.split("\n").map((line) => line.trim()).filter((line) => line !== "");

    const filteredList = ipList.filter(line => {
        const parts = line.split(',');
        return parts.length > 2 && parts[2].toLowerCase() === countryCode;
    });

    if (filteredList.length === 0) {
      await this.sendMessage(chatId, ` *Tidak ada IP untuk negara ${countryCode.toUpperCase()}*`, {
        parse_mode: "Markdown",
        ...options
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }
    const [ip, port, country, provider] = filteredList[Math.floor(Math.random() * filteredList.length)].split(",");
    if (!ip || !port) {
      await this.sendMessage(chatId, ` Data IP atau Port tidak lengkap dari daftar proxy.`, {
        parse_mode: "Markdown",
        ...options
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }
    const statusResponse = await fetch(`https://geovpn.vercel.app/check?ip=${ip}:${port}`);
    const ipData = await statusResponse.json();
    if (ipData.status !== "ACTIVE") {
      await this.sendMessage(chatId, ` *IP ${ip}:${port} tidak aktif.*`, {
        parse_mode: "Markdown",
        ...options
      });
      await this.deleteMessage(chatId, loadingMessage.result.message_id);
      return;
    }
    const getFlagEmoji3 = /* @__PURE__ */ __name((code) => code.toUpperCase().split("").map((c) => String.fromCodePoint(127462 + c.charCodeAt(0) - 65)).join(""), "getFlagEmoji");
    const generateUUID4 = /* @__PURE__ */ __name(() => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    }), "generateUUID");
    const toBase642 = /* @__PURE__ */ __name((str) => typeof btoa === "function" ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, "utf-8").toString("base64"), "toBase64");
    const HOSTKU2 = globalBot.getRandomHost();
    const path = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;
    const encodedVlessLabelTLS = encodeURIComponent(`ROTATE VLESS ${ipData.isp} ${ipData.country} TLS`);
    const encodedVlessLabelNTLS = encodeURIComponent(`ROTATE VLESS ${ipData.isp} ${ipData.country} NTLS`);
    const encodedTrojanLabelTLS = encodeURIComponent(`ROTATE TROJAN ${ipData.isp} ${ipData.country} TLS`);
    const encodedSsLabelTLS = encodeURIComponent(`ROTATE SHADOWSOCKS ${ipData.isp} ${ipData.country} TLS`);
    const encodedSsLabelNTLS = encodeURIComponent(`ROTATE SHADOWSOCKS ${ipData.isp} ${ipData.country} NTLS`);
    const configText = `
\`\`\`INFORMATION
IP      : ${ip}
PORT    : ${port}
ISP     : ${provider}
COUNTRY : ${ipData.country}
STATUS  : ${ipData.status}
\`\`\`
 *ROTATE VLESS TLS* 
\`\`\`
vless://${generateUUID4()}@${HOSTKU2}:443?encryption=none&security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(path)}#${encodedVlessLabelTLS}
\`\`\`
 *ROTATE VLESS NTLS* 
\`\`\`
vless://${generateUUID4()}@${HOSTKU2}:80?path=${encodeURIComponent(path)}&security=none&encryption=none&host=${HOSTKU2}&fp=randomized&type=ws&sni=${HOSTKU2}#${encodedVlessLabelNTLS}
\`\`\`
 *ROTATE TROJAN TLS* 
\`\`\`
trojan://${generateUUID4()}@${HOSTKU2}:443?encryption=none&security=tls&sni=${HOSTKU2}&fp=randomized&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(path)}#${encodedTrojanLabelTLS}
\`\`\`
 *ROTATE SS TLS* 
\`\`\`
ss://${toBase642(`none:${generateUUID4()}`)}@${HOSTKU2}:443?encryption=none&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(path)}&security=tls&sni=${HOSTKU2}#${encodedSsLabelTLS}
\`\`\`
 *ROTATE SS NTLS* 
\`\`\`
ss://${toBase642(`none:${generateUUID4()}`)}@${HOSTKU2}:80?encryption=none&type=ws&host=${HOSTKU2}&path=${encodeURIComponent(path)}&security=none&sni=${HOSTKU2}#${encodedSsLabelNTLS}
\`\`\`

 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    await this.sendMessage(chatId, configText, { parse_mode: "Markdown", ...options });
    await this.deleteMessage(chatId, loadingMessage.result.message_id);
  } catch (error) {
    console.error(error);
    await this.sendMessage(chatId, `   Terjadi kesalahan: ${error.message}`, options);
    await this.deleteMessage(chatId, loadingMessage.result.message_id);
  }
}
__name(rotateconfig, "rotateconfig");

// src/randomip/randomip.js

let globalIpList = [];
let globalCountryCodes = [];

async function fetchProxyList(url) {
    const response = await fetch(url);
    const ipText = await response.text();
    const ipList = ipText.split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
    return ipList;
}
__name(fetchProxyList, "fetchProxyList");

function getFlagEmoji(code) {
    const OFFSET = 127397;
    return [...code.toUpperCase()]
        .map((c) => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
        .join("");
}
__name(getFlagEmoji, "getFlagEmoji");

function buildCountryButtons(page = 0, pageSize = 15) {
    const start = page * pageSize;
    const end = start + pageSize;
    const pageItems = globalCountryCodes.slice(start, end);
    
    const buttons = pageItems.map((code) => ({
        text: `${getFlagEmoji(code)} ${code}`,
        callback_data: `cc_${code}`
    }));
    
    const inline_keyboard = [];
    for (let i = 0; i < buttons.length; i += 3) {
        inline_keyboard.push(buttons.slice(i, i + 3));
    }
    
    const navButtons = [];
    if (page > 0) {
        navButtons.push({ 
            text: "◀️ Prev", 
            callback_data: `randomip_page_${page - 1}` 
        });
    }
    
    if (end < globalCountryCodes.length) {
        navButtons.push({ 
            text: "Next ▶️", 
            callback_data: `randomip_page_${page + 1}` 
        });
    }
    
    if (navButtons.length) {
        inline_keyboard.push(navButtons);
    }
    
    return { inline_keyboard };
}
__name(buildCountryButtons, "buildCountryButtons");

function generateCountryIPsMessage(ipList, countryCode) {
    const filteredIPs = ipList.filter((line) => line.split(",")[2] === countryCode);
    if (filteredIPs.length === 0) return null;
    
    let msg = `🌍 *Proxy IP untuk negara ${countryCode} ${getFlagEmoji(countryCode)}:*\n\n`;
    
    filteredIPs.slice(0, 20).forEach((line) => {
        const [ip, port, _code, isp] = line.split(",");
        msg += `📍 *IP:PORT* : \`${ip}:${port}\`\n`;
        msg += `🌍 *Country* : ${_code} ${getFlagEmoji(_code)}\n`;
        msg += `💻 *ISP* : ${isp}\n\n`;
    });
    
    return msg;
}
__name(generateCountryIPsMessage, "generateCountryIPsMessage");

async function handleRandomIpCommand(bot, chatId, options) {
    const loadingMessage = await bot.sendMessage(chatId, "Sedang memproses...", options);
    const messageIdToDelete = loadingMessage && loadingMessage.result ? loadingMessage.result.message_id : null;
    try {
        globalIpList = await fetchProxyList("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
        
        if (globalIpList.length === 0) {
            await bot.sendMessage(chatId, 
                "❌ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*", 
                { parse_mode: "Markdown", ...options }
            );
            return;
        }
        
        globalCountryCodes = [...new Set(globalIpList.map((line) => line.split(",")[2]))].sort();
        
        const text = "Silakan pilih negara untuk mendapatkan IP random:";
        const reply_markup = buildCountryButtons(0);
        
        if (messageIdToDelete) {
            await bot.deleteMessage(chatId, messageIdToDelete);
        }

        await bot.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            reply_markup,
            ...options
        });
        
    } catch (error) {
        if (messageIdToDelete) {
            await bot.deleteMessage(chatId, messageIdToDelete);
        }
        await bot.sendMessage(chatId, 
            `⚠️ Gagal mengambil data IP: ${error.message}`,
            options
        );
    }
}
__name(handleRandomIpCommand, "handleRandomIpCommand");

async function handleCallbackQuery(bot, callbackQuery, options) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    if (data.startsWith("randomip_page_")) {
        const page = parseInt(data.split("_")[2], 10);
        const keyboard = buildCountryButtons(page);
        
        await bot.editMessageReplyMarkup({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        }, options);
        
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    if (data.startsWith("show_text_")) {
        const code = data.split("_")[2];
        const msg = generateCountryIPsMessage(globalIpList, code);

        if (!msg) {
            await bot.sendMessage(chatId,
                `❌ Tidak ditemukan IP untuk negara: ${code}`,
                { parse_mode: "Markdown", ...options }
            );
        } else {
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", ...options });
        }

        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    if (data.startsWith("download_file_")) {
        const code = data.split("_")[2];
        const msg = generateCountryIPsMessage(globalIpList, code);

        if (!msg) {
            await bot.sendMessage(chatId,
                `❌ Tidak ditemukan IP untuk negara: ${code}`,
                { parse_mode: "Markdown", ...options }
            );
        } else {
            await bot.sendDocument(chatId, msg, `proxy_ips_${code}.txt`, "text/plain", options);
        }

        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data.startsWith("cc_")) {
        const code = data.split("_")[1];
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "Tampilkan Teks", callback_data: `show_text_${code}` },
                    { text: "Unduh File (.txt)", callback_data: `download_file_${code}` }
                ]
            ]
        };

        await bot.editMessageText(
            chatId,
            messageId,
            `Anda memilih negara ${getFlagEmoji(code)} ${code}. Silakan pilih format output:`, 
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                ...options
            }
        );

        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
}
__name(handleCallbackQuery, "handleCallbackQuery");

// src/randomip/bot2.js

const TelegramBotku = class {
    static {
        __name(this, "TelegramBotku");
    }

    constructor(token, apiUrl = "https://api.telegram.org", ownerId, env, globalBot) {
        this.token = token;
        this.apiUrl = apiUrl;
        this.ownerId = ownerId;
        this.env = env;
        this.globalBot = globalBot;
    }

    async sendDocument(chatId, content, filename, mimeType, options = {}) {
        const formData = new FormData();
        const blob = new Blob([content], { type: mimeType });
        formData.append("document", blob, filename);
        formData.append("chat_id", chatId.toString());
        if (options.reply_to_message_id) {
            formData.append("reply_to_message_id", options.reply_to_message_id.toString());
        }
        if (options.message_thread_id) {
            formData.append("message_thread_id", options.message_thread_id.toString());
        }
        const response = await fetch(
            `${this.apiUrl}/bot${this.token}/sendDocument`,
            {
                method: "POST",
                body: formData
            }
        );
        return response.json();
    }

    async sendPhoto(chatId, photo, options = {}) {
        const url = `${this.apiUrl}/bot${this.token}/sendPhoto`;
        const body = {
            chat_id: chatId,
            photo,
            ...options
        };
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        return response.json();
    }

    async handleUpdate(update) {
        if (update.callback_query) {
            const data = update.callback_query.data;
            const message_thread_id = update.callback_query.message.message_thread_id;
            const options = message_thread_id ? { message_thread_id } : {};
            
            await handleCallbackQuery(this, update.callback_query, options);
            return new Response("OK", { status: 200 });
        }
        
        if (!update.message) return new Response("OK", { status: 200 });
        
        const chatId = update.message.chat.id;
        const text = update.message.text || "";
        const messageId = update.message.message_id;
        const message_thread_id = update.message.message_thread_id;
        
        const options = message_thread_id ? { message_thread_id } : {};

        if (text === "/proxy") {
            await handleRandomIpCommand(this, chatId, options);
            return new Response("OK", { status: 200 });
        }

        if (text === '/ping') {
            const delay = Date.now() - (update.message.date * 1000);
            const firstMessage = 'Pong!🏓';
            const secondMessage = 'Latency: ' + delay + 'ms';
            const replyMarkup = {
                inline_keyboard: [
                    [{ text: "📞 Hubungi Developer", url: "https://t.me/sampiiiiu" }]
                ]
            };
            await this.sendMessage(chatId, firstMessage, { ...options });
            await this.sendMessage(chatId, secondMessage, { reply_markup: replyMarkup, ...options });
            return new Response("OK", { status: 200 });
        }

        if (text.startsWith("/kuota")) {
    const args = text.split(" ");
    const number = args[1];

    if (!number) {
        await this.sendMessage(chatId, 
            "📱 *CEK KUOTA PAKET DATA*\n\n" +
            "ℹ️ *Cara Penggunaan:*\n" +
            "`/kuota <nomor_hp>`\n\n" +
            "✨ *Contoh:*\n" +
            "`/kuota 087812345678`\n\n" +
            "📝 *Pastikan nomor sudah terdaftar di operator*",
            { 
                parse_mode: "Markdown",
                ...options 
            }
        );
        return new Response("OK", { status: 200 });
    }

    // Validasi format nomor
    const phoneRegex = /^08[1-9][0-9]{7,10}$/;
    if (!phoneRegex.test(number)) {
        await this.sendMessage(chatId,
            "❌ *FORMAT NOMOR TIDAK VALID*\n\n" +
            "Format yang benar:\n" +
            "• 08xxxxxxxxxx\n" +
            "• 10-13 digit angka\n\n" +
            "Contoh: `087812345678`",
            { 
                parse_mode: "Markdown",
                ...options 
            }
        );
        return new Response("OK", { status: 200 });
    }

    const loadingMessage = await this.sendMessage(chatId, 
        "🔄 *Mengecek Kuota...*\n\n" +
        `📞 Nomor: \`${number}\`\n` +
        "⏳ Mohon tunggu sebentar...",
        { 
            parse_mode: "Markdown",
            ...options 
        }
    );
    const messageIdToDelete = loadingMessage && loadingMessage.result ? loadingMessage.result.message_id : null;

    try {
        const response = await fetch(`https://api.allorigins.win/raw?url=https://dompul.sampi.workers.dev/?msisdn=${number}`, {
            headers: {
                'User-Agent': 'curl/7.81.0'
            }
        });
        const responseText = await response.text();

        try {
            const data = JSON.parse(responseText);
            
            if (data.statusCode === 200 && data.status) {
                let resultText = data.data.hasil.replace(/<br>/g, "\n");
                
                // Simulasi struktur data dengan loop
                const lines = resultText.split('\n');
                let formattedMessage = 
                    "📊 *INFORMASI KUOTA PAKET DATA*\n\n" +
                    `📱 *Nomor:* \`${number}\`\n` +
                    "━━━━━━━━━━━━━━━━━━━━\n\n";
                
                // Proses setiap baris dengan gaya loop
                if (lines?.length) {
                    for (const line of lines) {
                        if (line.trim()) {
                            const trimmedLine = line.trim();
                            
                            // Format khusus untuk bagian penting
                            if (trimmedLine.includes('SISA PULSA')) {
                                formattedMessage += `💵 *${trimmedLine}*\n`;
                            } else if (trimmedLine.includes('SISA KUOTA')) {
                                formattedMessage += `📦 *${trimmedLine}*\n`;
                            } else if (trimmedLine.includes('MASA AKTIF')) {
                                formattedMessage += `⏰ *${trimmedLine}*\n`;
                            } else if (trimmedLine.includes(':')) {
                                const [key, value] = trimmedLine.split(':');
                                formattedMessage += `• *${key.trim()}:* \`${value?.trim() || 'Tidak tersedia'}\`\n`;
                            } else {
                                formattedMessage += `📌 ${trimmedLine}\n`;
                            }
                        }
                    }
                }
                
                formattedMessage += "\n━━━━━━━━━━━━━━━━━━━━\n" +
                    `🕐 *Update:* ${new Date().toLocaleString('id-ID')}\n` +
                    "💡 *Info:* Data mungkin tertunda beberapa menit";
                
                await this.sendMessage(chatId, formattedMessage, { 
                    parse_mode: "Markdown",
                    ...options 
                });
                
            } else {
                // Handle error dengan struktur yang konsisten
                const errorData = {
                    success: false,
                    message: data.message || 'Tidak ada informasi tambahan',
                    possibleCauses: [
                        "Nomor tidak terdaftar",
                        "Gangguan sistem operator", 
                        "Data tidak tersedia"
                    ]
                };
                
                if (errorData?.success === false) {
                    let errorMessage = 
                        "❌ *GAGAL MENGAMBIL DATA*\n\n" +
                        `📱 Nomor: \`${number}\`\n\n` +
                        "⚠️ *Kemungkinan penyebab:*\n";
                    
                    for (const cause of errorData.possibleCauses) {
                        errorMessage += `• ${cause}\n`;
                    }
                    
                    errorMessage += `\n📝 *Pesan Error:* ${errorData.message}`;
                    
                    await this.sendMessage(chatId, errorMessage, { 
                        parse_mode: "Markdown",
                        ...options 
                    });
                }
            }
        } catch (jsonError) {
            const errorCases = [
                "Format JSON tidak valid",
                "Respons API bermasalah", 
                "Data korup"
            ];
            
            let errorMessage = 
                "❌ *RESPONS TIDAK VALID*\n\n" +
                "Terjadi kesalahan dalam memproses data.\n\n" +
                "🔧 *Kemungkinan masalah:*\n";
            
            for (const errorCase of errorCases) {
                errorMessage += `• ${errorCase}\n`;
            }
            
            errorMessage += "\nSilakan coba beberapa saat lagi";
            
            await this.sendMessage(chatId, errorMessage, { 
                parse_mode: "Markdown",
                ...options 
            });
        }
    } catch (fetchError) {
        const fetchErrors = [
            "Tidak dapat terhubung ke server",
            "Timeout koneksi",
            "Gangguan jaringan"
        ];
        
        let errorMessage = 
            "❌ *KONEKSI GAGAL*\n\n" +
            "Tidak dapat terhubung ke server.\n\n" +
            "🔧 *Kemungkinan penyebab:*\n";
        
        for (const error of fetchErrors) {
            errorMessage += `• ${error}\n`;
        }
        
        errorMessage += `\n📝 *Detail Error:* ${fetchError.message}`;
        
        await this.sendMessage(chatId, errorMessage, { 
            parse_mode: "Markdown",
            ...options 
        });
    } finally {
        if (messageIdToDelete) {
            await this.deleteMessage(chatId, messageIdToDelete);
        }
    }
    return new Response("OK", { status: 200 });
}

        if (text === "/menu") {
            const menuText = `
  
╭─── • 𝗚𝗘𝗢 𝗕𝗢𝗧 𝗦𝗘𝗥𝗩𝗘𝗥 • ───╮
│
├─ 🌟 *Fitur Utama*
│  ├─ /proxyip ─ Config acak by Flag
│  ├─ /randomconfig ─ Config acak mix
│  ├─ /converter ─ Convert Akun V2ray
│  ├─ /config ─ Config auto-rotate
│  └─/sublink ─ Generate Akun V2ray
│
├─ 🛠️ *Tools & Info*
│  ├─ /proxy ─ Generate Proxy IPs
│  ├─ /stats ─ Statistik Penggunaan
│  ├─ /findproxy ─ Tutorial Cari Proxy
│  ├─ /userlist ─ Daftar Pengguna Bot
│  ├─ /ping ─ Cek status bot
│  └─ /kuota ─ Cek Data Paket XL
│
├─ 👤 *Manajemen Wildcard*
│  ├─ /add \\\`[bug]\\\` ─ Tambah Wildcard
│  ├─ /del \\\`[bug]\\\` ─ Hapus Wildcard (Admin)
│  └─ /list ─ Daftar Wildcard
│
├─ 📣 *Admin*
│  └─ /broadcast \\\`[teks]\\\` ─ Kirim Pesan
│
├─ ❤️ *Dukungan*
│  └─ /donate ─ Bantu Kopi Admin
│
╰─── •「 @sampiiiiu 」• ───╯

`;
  await this.sendMessage(chatId, menuText, { parse_mode: "Markdown", ...options });
  return new Response("OK", { status: 200 });
}

    if (text === "/proxyip") {
      await this.handleProxyipCommand(chatId, options);
      return new Response("OK", { status: 200 });
    }

if (text === "/findproxy") {
  const menuText = `

 *TUTORIAL CARI PROXY* 

 **FOFA (fofa.info)**
 Situs: [en.fofa.info](https://en.fofa.info)
 Kueri pencarian:
\`\`\`query
server=="cloudflare" && is_domain=false && banner="Content-Length: 155" && protocol="http" && org!="CLOUDFLARENET" && country="ID" && asn!="59134"
\`\`\`
 **Catatan:**
- Ubah \`asn="63949"\` untuk ISP tertentu
- Ubah \`country="ID"\` ke kode negara lain
- Tambahkan filter port: \`&& port="443"\`


 **HUNTER.HOW**
 Situs: [hunter.how](https://hunter.how)
 Kueri pencarian:
\`\`\`query
as.org!="Cloudflare London, LLC"&&product.name="CloudFlare"&&header.status_code=="400"&&protocol=="http"&&header.content_length=="655"&&ip.country=="ID"
\`\`\`
 **Catatan:**
- Tambah \`&&as.number="59134"\` untuk filter ASN
- Tambah \`&&ip.port="443"\` untuk fokus ke port 443
- Ubah negara dengan \`ip.country="SG"\`


 **SHODAN.IO**
 Situs: [shodan.io](https://shodan.io)
 Kueri pencarian:
\`\`\`query
product:"Cloudflare" country:"ID"
\`\`\`
 **Catatan:**
- Filter port: \`port:443\`
- Filter provider: \`org:"Akamai"\`


 **ZOOMEYE.HK**
 Situs: [zoomeye.hk](https://zoomeye.hk)
 Kueri pencarian:
\`\`\`query
+app:"Cloudflare" +service:"http" +title:"400 The plain HTTP request was sent to HTTPS port" +country:"Singapore"
\`\`\`
 **Catatan:**
- Tambah \`+asn:59134\` untuk filter ASN
- Spesifikkan port dengan \`+port:"443"\`
- Ubah negara dengan \`+country:"Indonesia"\`


 **BINARYEDGE.IO**
 Situs: [app.binaryedge.io](https://app.binaryedge.io)
 Kueri pencarian:
\`\`\`query
country:ID title:"400 The plain HTTP request was sent to HTTPS port" product:nginx protocol:"tcp" name:http banner:"Server: cloudflare" banner:"CF-RAY: -" NOT asn:209242
\`\`\`
 **Catatan:**
- Hapus \`NOT\` untuk mencari ASN tertentu (\`asn:59134\`)
- Tambah filter port dengan \`port:443\`
- Filter provider: \`as_name:Digitalocean\`


 **CENSYS.IO**
 Situs: [search.censys.io](https://search.censys.io)
 Kueri pencarian dasar:
\`\`\`query
not autonomous_system.name: "CLOUDFLARE*" and services: (software.product: "CloudFlare Load Balancer" and http.response.html_title: "400 The plain HTTP request was sent to HTTPS port") and location.country: "Indonesia"
\`\`\`
 **Catatan:**
- Tambahkan filter port dengan \`and services.port=443\`
- Filter provider: \`autonomous_system.name: "nama_provider"\`


 Untuk mengecek status proxy, kirim hasil pencarian langsung ke bot ini.

 *Modded By:* [Geo Project](https://t.me/sampiiiiu)
`;
  await this.sendMessage(chatId, menuText, { parse_mode: "Markdown", ...options });
  return new Response("OK", { status: 200 });
}

if (text === "/donate") {
    const imageUrl = "https://github.com/jaka1m/project/raw/main/BAYAR.jpg";
    
    try {
        await this.sendPhoto(chatId, imageUrl, {
            caption: `
💝 *Dukung Pengembangan Bot!* 💝

Bantu kami terus berkembang dengan scan QRIS di atas!

✨ *Fitur yang akan datang:*
• Server yang lebih cepat
• Lebih banyak negara proxy
• Fitur premium eksklusif
• Update rutin dan perbaikan bug

Terima kasih atas dukungannya! 🙏

_— Tim GEO BOT SERVER_
`.trim(),
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { 
                            text: "🌐 GEO PROJECT", 
                            url: "https://t.me/sampiiiiu" 
                        },
                        { 
                            text: "⭐ Beri Rating", 
                            url: "https://t.me/sampiiiiu" 
                        }
                    ],
                    [
                        { 
                            text: "💬 Channel Update", 
                            url: "https://t.me/sampiiiiu" 
                        }
                    ]
                ]
            },
            ...options
        });
        
    } catch (error) {
        console.error("❌ Error sending donation photo:", error);
        // Fallback to text message if image fails
        await this.sendMessage(chatId, 
            `💝 *Dukung Pengembangan Bot!*\n\n` +
            `Bantu kami terus berkembang dengan donasi melalui QRIS.\n\n` +
            `Terima kasih atas dukungannya! 🙏\n\n` +
            `🌐 [GEO PROJECT](https://t.me/sampiiiiu)`,
            { parse_mode: "Markdown", ...options }
        );
    }
    
    return new Response("OK", { status: 200 });
}

    if (text === "/stats") {
      const CLOUDFLARE_API_TOKEN = "jjtpiyLT97DYmd3zVz8Q3vypTSVxDRrcVF7yTBl8";
      const getTenDaysAgoDate = /* @__PURE__ */ __name(() => {
        const d = new Date();
        d.setDate(d.getDate() - 10);
        return d.toISOString().split("T")[0];
      }, "getTenDaysAgoDate");
      const tenDaysAgo = getTenDaysAgoDate();
      const loadingMsg = await this.sendMessage(
        chatId,
        "📊 *Mengambil data statistik untuk semua zona...*",
        { parse_mode: "Markdown", ...options }
      );
      const messageIdToDelete = loadingMsg?.result?.message_id;
      try {
        let allDailyData = [];
        const uniqueZoneIDs = [...new Set(this.globalBot.zones.map((z) => z.zoneID))];
        for (const zoneID of uniqueZoneIDs) {
          const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query: `query {
                viewer {
                  zones(filter: { zoneTag: "${zoneID}" }) {
                    httpRequests1dGroups(
                      limit: 10,
                      orderBy: [date_DESC],
                      filter: { date_geq: "${tenDaysAgo}" }
                    ) {
                      sum {
                        bytes
                        requests
                      }
                      dimensions {
                        date
                      }
                    }
                  }
                }
              }`
            })
          });
          const result = await response.json();
          if (result.data?.viewer?.zones?.length > 0) {
            allDailyData.push(...result.data.viewer.zones[0].httpRequests1dGroups);
          }
        }
        if (allDailyData.length === 0) {
          await this.editMessageText(
            chatId,
            loadingMsg.message_id,
            "📊 *Tidak ada data pemakaian untuk 10 hari terakhir di semua zona.*",
            { parse_mode: "Markdown" }
          );
          return new Response("OK", { status: 200 });
        }
        const dailyDataMap = new Map();
        allDailyData.forEach((day) => {
          const date = day.dimensions.date;
          if (!dailyDataMap.has(date)) {
            dailyDataMap.set(date, { bytes: 0, requests: 0 });
          }
          const existing = dailyDataMap.get(date);
          existing.bytes += day.sum.bytes;
          existing.requests += day.sum.requests;
        });
        const dailyData = Array.from(dailyDataMap, ([date, sum]) => ({
          dimensions: { date },
          sum
        })).sort((a, b) => new Date(b.dimensions.date) - new Date(a.dimensions.date));
        let totalBandwidth = 0;
        let totalRequests = 0;
        dailyData.forEach((day) => {
          totalBandwidth += day.sum.bytes;
          totalRequests += day.sum.requests;
        });
        let usageText = `📊 *STATISTIK PENGGUNAAN SERVER (SEMUA ZONA)*\n\n`;
        usageText += `⏰ **Periode:** 10 Hari Terakhir\n`;
        usageText += `📅 **Dari:** ${tenDaysAgo} hingga ${new Date().toISOString().split("T")[0]}\n\n`;
        usageText += `📈 **TOTAL KESELURUHAN:**\n`;
        usageText += `   ┣ 📊 Total Requests: ${totalRequests.toLocaleString()}\n`;
        usageText += `   ┗ 💾 Total Bandwidth: ${(totalBandwidth / 1024 ** 3).toFixed(2)} GB\n\n`;
        usageText += `📋 **RINCIAN HARIAN:**\n`;
        usageText += "┌─────────────────────────────────┐\n";
        dailyData.forEach((day, index) => {
          const tanggal = new Date(day.dimensions.date).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          });
          const totalData = (day.sum.bytes / 1024 ** 3).toFixed(2);
          const totalRequests2 = day.sum.requests.toLocaleString();
          usageText += `│ 📅 ${tanggal}\n`;
          usageText += `│ ├─ 📨 Requests: ${totalRequests2}\n`;
          usageText += `│ └─ 💾 Bandwidth: ${totalData} GB\n`;
          if (index < dailyData.length - 1) {
            usageText += "│ ───────────────────────────────\n";
          }
        });
        usageText += "└─────────────────────────────────┘\n\n";
        usageText += `💡 *Info:* Data diperbarui secara real-time dari Cloudflare Analytics`;
        await this.sendMessage(chatId, usageText, {
          parse_mode: "Markdown",
          ...options
        });
      } catch (error) {
        console.error("❌ Error fetching stats:", error);
        await this.sendMessage(
          chatId,
          `❌ *Gagal mengambil data statistik*\n\n_Error:_ \`${error.message}\`\n\nPastikan API token dan Zone ID masih valid.`,
          { parse_mode: "Markdown", ...options }
        );
      } finally {
        if (messageIdToDelete) {
          await this.deleteMessage(chatId, messageIdToDelete);
        }
      }
      return new Response("OK", { status: 200 });
    }
    
    if (text === "/start") {
        await this.sendPhoto(chatId, "https://github.com/jaka8m/BOT-CONVERTER/raw/main/start.png", {
            caption: `
✨━━━━━━━━━━━━━━━━━✨
🌟 **Welcome to Geo Bot Server!** 🌟
✨━━━━━━━━━━━━━━━━━✨

🤖 *Tentang Bot:*
Bot ini dirancang untuk membantu Anda memeriksa status proxy dan membuat konfigurasi V2Ray dengan mudah.

📋 *Cara Penggunaan:*
1️⃣ Kirim alamat IP dan port (opsional, default: 443)
2️⃣ Tunggu beberapa detik untuk proses pengecekan
3️⃣ Dapatkan hasil status dan konfigurasi

🔧 *Format Input yang Diterima:*
• \`176.97.78.80\`
• \`176.97.78.80:2053\`

📂 *Perintah Lainnya:*
Ketik \`/menu\` untuk melihat semua perintah yang tersedia.

⚠️ *Penting:*
- Jika status proxy *DEAD*, konfigurasi tidak akan dibuat
- Pastikan format input sesuai untuk hasil terbaik

🔗 *Tautan Terkait:*
🌐 [WEB VPN TUNNEL](https://joss.krekkrek.web.id)
📺 [CHANNEL VPS & Script](https://t.me/testikuy_mang)
👥 [GRUP PHREAKER](https://t.me/+Q1ARd8ZsAuM2xB6-)
✨━━━━━━━━━━━━━━━━━✨

*Terima kasih telah menggunakan layanan kami!* 🚀
`.trim(),
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📞 Hubungi Developer", url: "https://t.me/sampiiiiu" }]
                ]
            },
            ...options
        });
        return new Response("OK", { status: 200 });
    }
return new Response("OK", { status: 200 });
}
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  async editMessageReplyMarkup({ chat_id, message_id, reply_markup }) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = { chat_id, message_id, reply_markup };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async answerCallbackQuery(callbackQueryId) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
    async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
};
async function handleProxyipCommand(bot, chatId, options) {
  const loadingMessage = await bot.sendMessage(chatId, "  *Sedang memproses, harap tunggu...*", { parse_mode: "Markdown", ...options });
  try {
    const response = await fetch("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
    const ipText = await response.text();
    const ipList = ipText.split("\n").filter((line) => line.trim() !== "");
    if (ipList.length === 0) {
      await bot.editMessageText("   *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*", {
        chat_id: chatId,
        message_id: loadingMessage.result.message_id,
        ...options
      });
      return;
    }
    const countryCodes = [...new Set(ipList.map((line) => line.split(",")[2]))].sort();
    paginationState.set(chatId, { countryCodes, page: 0 });
    const buttons = generateCountryButtons(countryCodes, 0);
    await bot.deleteMessage(chatId, loadingMessage.result.message_id);
    await bot.sendMessage(chatId, "  *Pilih negara:*", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
      ...options
    });
  } catch (error) {
    console.error("Error fetching IP list:", error);
    await bot.editMessageText(`   *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, {
      chat_id: chatId,
      message_id: loadingMessage.result.message_id,
      ...options
    });
  }
}
__name(handleProxyipCommand, "handleProxyipCommand");

// src/checkip/cek.js
const WILDCARD_MAP = {
  ava: "ava.game.naver.com",
  api: "api.midtrans.com",
  blibli: "business.blibli.com",
  ig: "graph.instagram.com",
  vidio: "quiz.int.vidio.com",
  iflix: "live.iflix.com",
  zoom: "support.zoom.us",
  webex: "blog.webex.com",
  spotify: "investors.spotify.com",
  netflix: "cache.netflix.com",
  viu: "zaintest.vuclip.com",
  ruangguru: "io.ruangguru.com",
  fb: "investor.fb.com",
  bakrie: "bakrie.ac.id"
};
const WILDCARD_OPTIONS = Object.entries(WILDCARD_MAP).map(
  ([value, text]) => ({ text, value })
);
const DEFAULT_HOST = "joss.krekkrek.web.id";
const API_URL = "https://geovpn.vercel.app/check?ip=";
async function fetchIPData(ip, port) {
  try {
    const response = await fetch(`${API_URL}${encodeURIComponent(ip)}:${encodeURIComponent(port)}`);
    if (!response.ok) throw new Error("Gagal mengambil data dari API.");
    return await response.json();
  } catch (error) {
    console.error("Error fetching IP data:", error);
    return null;
  }
}
__name(fetchIPData, "fetchIPData");
function createProtocolInlineKeyboard(ip, port) {
  return {
    inline_keyboard: [
      [
        { text: " VLESS", callback_data: `PROTOCOL|VLESS|${ip}|${port}` },
        { text: " TROJAN", callback_data: `PROTOCOL|TROJAN|${ip}|${port}` }
      ],
      [
        { text: " SHADOWSOCKS", callback_data: `PROTOCOL|SHADOWSOCKS|${ip}|${port}` }
      ]
    ]
  };
}
__name(createProtocolInlineKeyboard, "createProtocolInlineKeyboard");
function createInitialWildcardInlineKeyboard(ip, port, protocol) {
  return {
    inline_keyboard: [
      [
        { text: " NO WILDCARD", callback_data: `NOWILDCARD|${protocol}|${ip}|${port}` },
        { text: " WILDCARD", callback_data: `SHOW_WILDCARD|${protocol}|${ip}|${port}` }
      ],
      [
        { text: " Kembali", callback_data: `BACK|${ip}|${port}` }
      ]
    ]
  };
}
__name(createInitialWildcardInlineKeyboard, "createInitialWildcardInlineKeyboard");
function createWildcardOptionsInlineKeyboard(ip, port, protocol) {
  const buttons = WILDCARD_OPTIONS.map((option, index) => [
    { text: ` ${index + 1}. ${option.text}`, callback_data: `WILDCARD|${protocol}|${ip}|${port}|${option.value}` }
  ]);
  buttons.push([{ text: " Kembali", callback_data: `BACK|${ip}|${port}` }]);
  return { inline_keyboard: buttons };
}
__name(createWildcardOptionsInlineKeyboard, "createWildcardOptionsInlineKeyboard");
function generateUUID2() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
__name(generateUUID2, "generateUUID");
function toBase64(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...new Uint8Array(data.buffer)));
}
__name(toBase64, "toBase64");
function generateConfig(config, protocol, wildcardKey = null, globalBot) {
  if (!config || !config.ip || !config.port || !config.isp) {
    return "❌ Data tidak valid!";
  }
  const DEFAULT_HOST = globalBot.getRandomHost();
  const host = wildcardKey ? `${WILDCARD_MAP[wildcardKey]}.${DEFAULT_HOST}` : DEFAULT_HOST;
  const sni = host;
  const uuid = generateUUID2();
  const path = encodeURIComponent(`/Free-VPN-CF-Geo-Project/${config.ip}=${config.port}`);
  const ispEncoded = encodeURIComponent(config.isp);
  let qrUrl = "";
  if (protocol === "VLESS") {
  const vlessTLS = `vless://${uuid}@${host}:443?encryption=none&security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
  const vlessNTLS = `vless://${uuid}@${host}:80?path=${path}&security=none&encryption=none&host=${host}&fp=randomized&type=ws&sni=${host}#${ispEncoded}`;
  qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(vlessTLS)}&size=400x400`;
  return `
\`\`\`VLESS-TLS
${vlessTLS}
\`\`\`
\`\`\`VLESS-NTLS
${vlessNTLS}
\`\`\`
 [QR Code URL](${qrUrl})
 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
}

if (protocol === "TROJAN") {
  const configString1 = `trojan://${uuid}@${host}:443?security=tls&sni=${sni}&fp=randomized&type=ws&host=${host}&path=${path}#${ispEncoded}`;
  const configString2 = `trojan://${uuid}@${host}:80?path=${path}&security=none&encryption=none&host=${host}&fp=randomized&type=ws&sni=${host}#${ispEncoded}`;
  qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configString1)}&size=400x400`;
  return `
\`\`\`TROJAN-TLS
${configString1}
\`\`\`
\`\`\`TROJAN-NTLS
${configString2}
\`\`\`
 [QR Code URL](${qrUrl})
 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
}

if (protocol === "SHADOWSOCKS") {
  const configString1 = `ss://${toBase64(`none:${uuid}`)}@${host}:443?encryption=none&type=ws&host=${host}&path=${path}&security=tls&sni=${sni}#${ispEncoded}`;
  const configString2 = `ss://${toBase64(`none:${uuid}`)}@${host}:80?encryption=none&type=ws&host=${host}&path=${path}&security=none&sni=${sni}#${ispEncoded}`;
  qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(configString1)}&size=400x400`;
  return `
\`\`\`SHADOWSOCKS-TLS
${configString1}
\`\`\`
\`\`\`SHADOWSOCKS-NTLS
${configString2}
\`\`\`
 [QR Code URL](${qrUrl})
 [View Google Maps](https://www.google.com/maps?q=${config.latitude},${config.longitude})
 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
}

return " Unknown protocol!";
}
__name(generateConfig, "generateConfig");

// src/checkip/botCek.js
const TelegramProxyCekBot = class {
  static {
    __name(this, "TelegramProxyCekBot");
  }
  constructor(token, apiUrl = "https://api.telegram.org", ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.globalBot = globalBot;
  }
  async sendRequest(method, body) {
    const url = `${this.apiUrl}/bot${this.token}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async sendMessage(chatId, text, extra = {}) {
    return this.sendRequest("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", ...extra });
  }
  async editMessage(chatId, messageId, text, extra = {}) {
    return this.sendRequest("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown", ...extra });
  }
  async deleteMessage(chatId, messageId) {
    return this.sendRequest("deleteMessage", { chat_id: chatId, message_id: messageId });
  }
  async sendChatAction(chatId, action = "typing") {
    return this.sendRequest("sendChatAction", { chat_id: chatId, action });
  }
  async handleUpdate(update, ctx) {
    if (!update.message && !update.callback_query) return new Response("OK", { status: 200 });
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const messageId = update.message.message_id;
      const text = update.message.text.trim();
      const message_thread_id = update.message.message_thread_id;
      const options = message_thread_id ? { message_thread_id } : {};
      const ipOnlyMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/);
      const ipPortMatch = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
      if (!ipOnlyMatch && !ipPortMatch) {
        return new Response("OK", { status: 200 });
      }
      const ip = ipPortMatch ? ipPortMatch[1] : ipOnlyMatch[1];
      const port = ipPortMatch ? ipPortMatch[2] : "443";
      await this.deleteMessage(chatId, messageId);
      await this.sendChatAction(chatId, "typing");
      const loadingMsg = await this.sendMessage(chatId, `
\`\`\`Running
Please wait while it is being processed...
\`\`\`
`, options);
      const data = await fetchIPData(ip, port);
      if (!data) {
        await this.editMessage(chatId, loadingMsg.result.message_id, `❌ Gagal mengambil data untuk IP ${ip}:${port}`, options);
        return new Response("OK", { status: 200 });
      }
      const { isp, country, delay, status } = data;
      const infoText = `\`\`\`INFORMATION
IP     : ${ip}
PORT   : ${port}
ISP    : ${isp}
Country: ${country || "-"}
Delay  : ${delay || "-"}
Status : ${status || "-"}
\`\`\`
Pilih protokol:`;
      await this.editMessage(chatId, loadingMsg.result.message_id, infoText, {
        reply_markup: createProtocolInlineKeyboard(ip, port), ...options
      });
      return new Response("OK", { status: 200 });
    }
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;
      const message_thread_id = callback.message.message_thread_id;
      const options = message_thread_id ? { message_thread_id } : {};
      const parts = data.split("|");
      if (parts[0] === "PROTOCOL") {
        const [_, protocol, ip, port] = parts;
        await this.editMessage(chatId, messageId, ` ⚙️Opsi wildcard untuk ${protocol}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol), ...options
        });
        return new Response("OK", { status: 200 });
      }
      if (parts[0] === "SHOW_WILDCARD") {
        const [_, protocol, ip, port] = parts;
        await this.editMessage(chatId, messageId, ` Opsi wildcard untuk ${protocol}`, {
          reply_markup: createWildcardOptionsInlineKeyboard(ip, port, protocol), ...options
        });
        return new Response("OK", { status: 200 });
      }
      if (parts[0] === "NOWILDCARD") {
        const [_, protocol, ip, port] = parts;
        await this.sendChatAction(chatId, "typing");
        const loadingMsg = await this.sendMessage(chatId, `
\`\`\`Running
Please wait while it is being processed...
\`\`\`
`, options);
        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`, options);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response("OK", { status: 200 });
        }
        const configText = generateConfig(dataInfo, protocol, null, this.globalBot);
        await this.editMessage(chatId, messageId, ` Config ${protocol} NO Wildcard:
${configText}
`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{
              text: " Back",
              callback_data: `BACK_WILDCARD|${protocol}|${ip}|${port}`
            }]]
          }, ...options
        });
        await this.deleteMessage(chatId, loadingMsg.result.message_id);
        return new Response("OK", { status: 200 });
      }
      if (parts[0] === "WILDCARD") {
        const [_, protocol, ip, port, wildcardKey] = parts;
        await this.sendChatAction(chatId, "typing");
        const loadingMsg = await this.sendMessage(chatId, `
\`\`\`Running
Please wait while it is being processed...
\`\`\`
`, options);
        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`, options);
          await this.deleteMessage(chatId, loadingMsg.result.message_id);
          return new Response("OK", { status: 200 });
        }
        const configText = generateConfig(dataInfo, protocol, wildcardKey, this.globalBot);
        await this.editMessage(chatId, messageId, ` Config ${protocol} Wildcard *${wildcardKey}*:
${configText}
`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{
              text: " Back",
              callback_data: `BACK_WILDCARD|${protocol}|${ip}|${port}`
            }]]
          }, ...options
        });
        await this.deleteMessage(chatId, loadingMsg.result.message_id);
        return new Response("OK", { status: 200 });
      }
      if (parts[0] === "BACK") {
        const [_, ip, port] = parts;
        const dataInfo = await fetchIPData(ip, port);
        if (!dataInfo) {
          await this.editMessage(chatId, messageId, `❌ Gagal mengambil data untuk IP ${ip}:${port}`, options);
          return new Response("OK", { status: 200 });
        }
        const infoText = `\`\`\`INFORMATION
IP     : ${ip}
PORT   : ${port}
ISP    : ${dataInfo.isp}
Country: ${dataInfo.country}
Delay  : ${dataInfo.delay}
Status : ${dataInfo.status}
\`\`\`
Pilih protokol:`;
        await this.editMessage(chatId, messageId, infoText, {
          reply_markup: createProtocolInlineKeyboard(ip, port), ...options
        });
        return new Response("OK", { status: 200 });
      }
      if (parts[0] === "BACK_WILDCARD") {
        const [_, protocol, ip, port] = parts;
        await this.editMessage(chatId, messageId, ` Opsi wildcard untuk ${protocol}`, {
          reply_markup: createInitialWildcardInlineKeyboard(ip, port, protocol), ...options
        });
        return new Response("OK", { status: 200 });
      }
      return new Response("OK", { status: 200 });
    }
  }
};

// src/proxyip/proxyip.js
const APIKU = "https://geovpn.vercel.app/check?ip=";
const DEFAULT_HOST2 = "joss.krekkrek.web.id";
const sentMessages = /* @__PURE__ */ new Map();
const paginationState = /* @__PURE__ */ new Map();
function generateUUID3() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
__name(generateUUID3, "generateUUID");
function getFlagEmoji2(countryCode) {
  if (!countryCode) return "";
  const codePoints = [...countryCode.toUpperCase()].map((c) => 127462 - 65 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}
__name(getFlagEmoji2, "getFlagEmoji");
function canSendMessage(chatId, key, interval = 3e4) {
  const now = Date.now();
  if (!sentMessages.has(chatId)) sentMessages.set(chatId, {});
  const userData = sentMessages.get(chatId);
  if (!userData[key] || now - userData[key] > interval) {
    userData[key] = now;
    return true;
  }
  return false;
}
__name(canSendMessage, "canSendMessage");
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
__name(chunkArray, "chunkArray");
function generateCountryButtons(countryCodes, page = 0, pageSize = 12) {
  const totalPages = Math.ceil(countryCodes.length / pageSize);
  const start = page * pageSize;
  const pageItems = countryCodes.slice(start, start + pageSize);
  const rows = chunkArray(pageItems, 3);
  const buttons = rows.map(
    (row) => row.map((code) => ({
      text: `${getFlagEmoji2(code)} ${code}`,
      callback_data: `select_${code}`
    }))
  );
  const navButtons = [];
if (page > 0) {
  navButtons.push({ text: " Prev", callback_data: `page_prev_${page - 1}` });
}
if (page < totalPages - 1) {
  navButtons.push({ text: "Next ", callback_data: `page_next_${page + 1}` });
}
navButtons.push({ text: " Back", callback_data: `page_back` });
buttons.push(navButtons);
return buttons;
}
__name(generateCountryButtons, "generateCountryButtons");
async function handleCallbackQuery2(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const message_thread_id = callbackQuery.message.message_thread_id;
  const options = message_thread_id ? { message_thread_id } : {};

  if (data.startsWith("page_")) {
    if (!paginationState.has(chatId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired, silakan ulangi perintah." });
      return;
    }
    const { countryCodes } = paginationState.get(chatId);
    let page = paginationState.get(chatId).page;
    if (data === "page_back") {
      paginationState.delete(chatId);
      await bot.editMessageText(" *Pilih negara:*", {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: generateCountryButtons(countryCodes, 0) },
        ...options
      });
      paginationState.set(chatId, { countryCodes, page: 0 });
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith("page_prev_")) {
      const newPage = parseInt(data.split("_")[2], 10);
      if (newPage >= 0) {
        page = newPage;
        paginationState.set(chatId, { countryCodes, page });
        const buttons = generateCountryButtons(countryCodes, page);
        await bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          ...options
        });
      }
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith("page_next_")) {
      const newPage = parseInt(data.split("_")[2], 10);
      const maxPage = Math.ceil(countryCodes.length / 12) - 1;
      if (newPage <= maxPage) {
        page = newPage;
        paginationState.set(chatId, { countryCodes, page });
        const buttons = generateCountryButtons(countryCodes, page);
        await bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          ...options
        });
      }
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
  }
  if (data.startsWith("select_")) {
    if (!canSendMessage(chatId, `select_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    const countryCode = data.split("_")[1];
    try {
      const response = await fetch("https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt");
      const ipText = await response.text();
      const ipList = ipText.split("\n").filter((line) => line.trim() !== "");
      const filteredIPs = ipList.filter((line) => line.split(",")[2] === countryCode);
      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `   *Tidak ada IP tersedia untuk negara ${countryCode}.*`, { parse_mode: "Markdown", ...options });
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
      }
      const randomProxy = filteredIPs[Math.floor(Math.random() * filteredIPs.length)];
      const [ip, port, , provider] = randomProxy.split(",");
      const statusResponse = await fetch(`${APIKU}${ip}:${port}`);
      const ipData = await statusResponse.json();
      const status = ipData.status === "ACTIVE" ? " ACTIVE" : " DEAD";
      const safeProvider = provider.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
      const buttons = [
        [
          { text: " VLESS", callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: " TROJAN", callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` }
        ],
        [
          { text: " SHADOWSOCKS", callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }
        ]
      ];
      let messageText = ` *Info IP untuk ${getFlagEmoji2(countryCode)} ${countryCode} :*
\`\`\`
INFORMATION
IP      : ${ip}
PORT    : ${port}
ISP     : ${provider}
COUNTRY : ${ipData.country}
STATUS  : ${status}
\`\`\``;
      if (ipData.latitude && ipData.longitude) {
        messageText += `
  [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }
      await bot.sendMessage(chatId, messageText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
        ...options
      });
    } catch (error) {
      console.error("  Error fetching IP status:", error);
      await bot.sendMessage(chatId, "   *Terjadi kesalahan saat memverifikasi IP.*", { parse_mode: "Markdown", ...options });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
  if (data.startsWith("config_")) {
    if (!canSendMessage(chatId, `config_${data}`)) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    try {
      const [_, type, ip, port, countryCode, provider] = data.split("_");
      const uuid = generateUUID3();
      const path = encodeURIComponent(`/Free-VPN-CF-Geo-Project/${ip}=${port}`);
      const prov = encodeURIComponent(`${provider} ${getFlagEmoji2(countryCode)}`);
      const toBase642 = /* @__PURE__ */ __name((str) => btoa(unescape(encodeURIComponent(str))), "toBase64");
      const randomHost = bot.globalBot.getRandomHost();
      let configText = "";
      if (type === "vless") {
        configText = `\`\`\`VLESS-TLS
vless://${uuid}@${randomHost}:443?encryption=none&security=tls&sni=${randomHost}&fp=randomized&type=ws&host=${randomHost}&path=${path}#${prov}
\`\`\`\`\`\`VLESS-NTLS
vless://${uuid}@${randomHost}:80?path=${path}&security=none&encryption=none&host=${randomHost}&fp=randomized&type=ws&sni=${randomHost}#${prov}
\`\`\``;
      } else if (type === "trojan") {
        configText = `\`\`\`TROJAN-TLS
trojan://${uuid}@${randomHost}:443?encryption=none&security=tls&sni=${randomHost}&fp=randomized&type=ws&host=${randomHost}&path=${path}#${prov}
\`\`\`\`\`\`TROJAN-NTLS
trojan://${uuid}@${randomHost}:80?path=${path}&security=none&encryption=none&host=${randomHost}&fp=randomized&type=ws&sni=${randomHost}#${prov}
\`\`\``;
      } else if (type === "ss") {
        configText = `\`\`\`SHADOWSOCKS-TLS
ss://${toBase642(`none:${uuid}`)}@${randomHost}:443?encryption=none&type=ws&host=${randomHost}&path=${path}&security=tls&sni=${randomHost}#${prov}
\`\`\`\`\`\`SHADOWSOCKS-NTLS
ss://${toBase642(`none:${uuid}`)}@${randomHost}:80?encryption=none&type=ws&host=${randomHost}&path=${path}&security=none&sni=${randomHost}#${prov}
\`\`\``;
      }
      await bot.sendMessage(chatId, configText, { parse_mode: "Markdown", ...options });
    } catch (err) {
      console.error(" Error generating config:", err);
      await bot.sendMessage(chatId, "   *Gagal membuat konfigurasi.*", { parse_mode: "Markdown", ...options });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
  await bot.answerCallbackQuery(callbackQuery.id);
}
__name(handleCallbackQuery2, "handleCallbackQuery");

// src/proxyip/bot3.js
class TelegramProxyBot {
  static {
    __name(this, "TelegramProxyBot");
  }

  constructor(token, apiUrl = "https://api.telegram.org", ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.globalBot = globalBot;
  }

  async handleUpdate(update, ctx) {
    if (update.message) {
      const msg = update.message;
      if (msg.text && msg.text.startsWith("/proxyip")) {
        const options = msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {};
        await handleProxyipCommand(this, msg.chat.id, options);
      }
    }

    if (update.callback_query) {
      await handleCallbackQuery2(this, update.callback_query);
    }

    return new Response("OK", { status: 200 });
  }

  async editMessage(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    return res.json();
  }

  async editMessageText(text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = { text, ...options };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    return res.json();
  }
  
  async answerCallbackQuery(callbackQueryId, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/answerCallbackQuery`;
    const body = { callback_query_id: callbackQueryId, ...options };
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    return res.json();
  }

  async editMessageReplyMarkup(replyMarkup, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageReplyMarkup`;
    const body = { ...options, reply_markup: replyMarkup };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    return res.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
}

// src/wildcard/botwild.js
class KonstantaGlobalbot {
  static {
    __name(this, "KonstantaGlobalbot");
  }

  constructor({ apiKey, zones, accountID, apiEmail, serviceName }) {
    this.apiKey = apiKey;
    this.zones = zones;
    this.accountID = accountID;
    this.apiEmail = apiEmail;
    this.serviceName = serviceName;
    
    this.headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "X-Auth-Email": this.apiEmail,
      "X-Auth-Key": this.apiKey,
      "Content-Type": "application/json"
    };
  }

  async getDomainObjects() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    
    if (!res.ok) return [];
    
    const json = await res.json();
    return json.result.filter((d) => d.service === this.serviceName);
  }

  async getDomainList() {
    const domains = await this.getDomainObjects();
    return domains.map((d) => d.hostname);
  }

  async addSubdomain(subdomainInput) {
    const subdomain = subdomainInput.toLowerCase();
    let targetZone = this.zones.find((z) => subdomain.endsWith(`.${z.rootDomain}`));
    let fullDomain;
    if (targetZone) {
      fullDomain = subdomain;
    } else {
      targetZone = this.zones[0];
      fullDomain = `${subdomain}.${targetZone.rootDomain}`;
    }
    const registered = await this.getDomainList();
    if (registered.includes(fullDomain))
      return 409;
    try {
      const testRes = await fetch(`https://${subdomain}`);
      if (testRes.status === 530)
        return 530;
    } catch {
      return 400;
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname: fullDomain,
      service: this.serviceName,
      zone_id: targetZone.zoneID
    };
    const res = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    return res.status;
  }

  async deleteSubdomain(subdomain) {
    const domain = subdomain.toLowerCase();
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const listRes = await fetch(listUrl, { headers: this.headers });
    if (!listRes.ok)
      return listRes.status;
    const json = await listRes.json();
    const obj = json.result.find((d) => d.hostname === domain);
    if (!obj) {
      for (const zone of this.zones) {
        const fullDomain = `${domain}.${zone.rootDomain}`;
        const objWithRoot = json.result.find((d) => d.hostname === fullDomain);
        if (objWithRoot) {
          const res = await fetch(`${listUrl}/${objWithRoot.id}`, {
            method: "DELETE",
            headers: this.headers
          });
          return res.status;
        }
      }
      return 404;
    }
    const res = await fetch(`${listUrl}/${obj.id}`, {
      method: "DELETE",
      headers: this.headers
    });
    return res.status;
  }

  saveDomainRequest(request) {
    globalThis.subdomainRequests.push(request);
  }

  findPendingRequest(subdomain, requesterId = null) {
    return globalThis.subdomainRequests.find(
      (r) => r.subdomain === subdomain && 
             r.status === "pending" && 
             (requesterId === null || r.requesterId === requesterId)
    );
  }

  updateRequestStatus(subdomain, status) {
    const r = globalThis.subdomainRequests.find(
      (r2) => r2.subdomain === subdomain && r2.status === "pending"
    );
    if (r) r.status = status;
  }

  getAllRequests() {
    return globalThis.subdomainRequests.slice();
  }

  getRandomHost() {
    const randomIndex = Math.floor(Math.random() * this.zones.length);
    const rootDomain = this.zones[randomIndex].rootDomain;
    return `${this.serviceName}.${rootDomain}`;
  }
}

class TelegramWildcardBot {
  static {
    __name(this, "TelegramWildcardBot");
  }

  constructor(token, apiUrl, ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl || "https://api.telegram.org";
    this.ownerId = ownerId;
    this.globalBot = globalBot;
    this.awaitingAddList = {};
    this.awaitingDeleteList = {};
    
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  async editMessage(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async handleUpdate(update, ctx) {
    if (!update.message) return new Response("OK", { status: 200 });
    
    const chatId = update.message.chat.id;
    const from = update.message.from;
    const username = from.username || from.first_name || "Unknown";
    const text = update.message.text || "";
    const message_thread_id = update.message.message_thread_id;
    const options = message_thread_id ? { message_thread_id } : {};
    const isOwner = chatId === this.ownerId;
    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    // Handle /add command
    if (text.startsWith("/add")) {
      const loadingMessage = await this.sendMessage(chatId, "Sedang memproses...", options);
      const messageIdToDelete = loadingMessage?.result?.message_id;
      
      try {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const firstLine = lines[0];
        const restLines = lines.slice(1);
        let subdomains = [];
        
        if (firstLine.includes(" ") && restLines.length === 0) {
          subdomains = firstLine.split(" ").slice(1).map((s) => s.trim()).filter(Boolean);
        } else if (restLines.length > 0) {
          subdomains = restLines;
        }
        
        if (subdomains.length === 0) {
          await this.sendMessage(
            chatId,
            "Mohon sertakan satu atau lebih subdomain setelah /add.",
            options
          );
          return new Response("OK", { status: 200 });
        }
        
        const results = [];
        for (const sd of subdomains) {
          const cleanSd = sd.trim().toLowerCase();
          let st = 500;
          let fullDomain = cleanSd;
          const targetZone = this.globalBot.zones.find((z) => cleanSd.endsWith(`.${z.rootDomain}`));
          if (!targetZone) {
            fullDomain = `${cleanSd}.${this.globalBot.zones[0].rootDomain}`;
          }
          try {
            st = await this.globalBot.addSubdomain(cleanSd);
          } catch {
          }
          results.push(
            st === 200 ? `${fullDomain} berhasil ditambahkan.` : `Gagal menambahkan domain ${fullDomain}, status: ${st}`
          );
        }
        
        await this.sendMessage(chatId, results.join("\n\n"), options);
      } finally {
        if (messageIdToDelete) {
          await this.deleteMessage(chatId, messageIdToDelete);
        }
      }
      
      return new Response("OK", { status: 200 });
    }

    // Handle /del command
    if (text.startsWith("/del")) {
      if (!isOwner) {
        await this.sendMessage(chatId, "Anda tidak berwenang menggunakan perintah ini.", options);
        return new Response("OK", { status: 200 });
      }
      
      const args = text.split(" ").slice(1);
      if (args.length === 0) {
        await this.sendMessage(
          chatId,
          "Gunakan `/del [nomor]` untuk menghapus wildcard.\nContoh: `/del 1 3 5`\nGunakan `/list` untuk melihat daftar nomor.",
          { parse_mode: "Markdown", ...options }
        );
        return new Response("OK", { status: 200 });
      }
      
      const loadingMessage = await this.sendMessage(chatId, "Sedang memproses...", options);
      const messageIdToDelete = loadingMessage?.result?.message_id;
      
      try {
        const domainObjects = await this.globalBot.getDomainObjects();
        if (domainObjects.length === 0) {
          await this.sendMessage(chatId, "Tidak ada wildcard yang terdaftar untuk dihapus.", options);
          return new Response("OK", { status: 200 });
        }
        
        const indicesToDelete = args.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
        if (indicesToDelete.length === 0) {
          await this.sendMessage(chatId, "Mohon sertakan nomor yang valid untuk dihapus.", options);
          return new Response("OK", { status: 200 });
        }
        
        const results = [];
        for (const index of indicesToDelete) {
          if (index < 1 || index > domainObjects.length) {
            results.push(`Nomor ${index} tidak valid.`);
            continue;
          }
          
          const domainObjectToDelete = domainObjects[index - 1];
          const domainId = domainObjectToDelete.id;
          const domainHostname = domainObjectToDelete.hostname;
          const url = `https://api.cloudflare.com/client/v4/accounts/${this.globalBot.accountID}/workers/domains/${domainId}`;
          let status = 500;
          
          try {
            const res = await fetch(url, {
              method: "DELETE",
              headers: this.globalBot.headers
            });
            status = res.status;
          } catch (e) {
            console.error(`Error deleting ${domainHostname}:`, e);
          }
          
          if (status === 200) {
            results.push(`Berhasil menghapus ${domainHostname} (Nomor ${index})`);
          } else {
            results.push(`Gagal menghapus ${domainHostname} (Nomor ${index}), status: ${status}`);
          }
        }
        
        await this.sendMessage(chatId, results.join("\n"), options);
      } finally {
        if (messageIdToDelete) {
          await this.deleteMessage(chatId, messageIdToDelete);
        }
      }
      
      return new Response("OK", { status: 200 });
    }
    
    // Handle /listdom command
    if (text.startsWith("/listdom")) {
      const loadingMessage = await this.sendMessage(chatId, "🔍 *Memeriksa domain, mohon tunggu...*", { parse_mode: "Markdown", ...options });
      const messageIdToEdit = loadingMessage.result.message_id;

      try {
        const domains = this.globalBot.zones.map((zone) => `${this.globalBot.serviceName}.${zone.rootDomain}`);
        if (!domains.length) {
          await this.editMessage(chatId, messageIdToEdit, "Tidak ada domain root yang dikonfigurasi untuk diperiksa.", options);
          return new Response("OK", { status: 200 });
        }

        const checkDomain = async (domain) => {
          try {
            const response = await fetch(`https://${domain}`, { method: 'HEAD', redirect: 'manual' });
            if (response.status >= 200 && response.status < 300) {
              return `✅ \`${domain}\` - Active`;
            } else if (response.status >= 300 && response.status < 400) {
              return `↪️ \`${domain}\` - Redirect`;
            } else if (response.status === 1027) {
              return `🔒 \`${domain}\` - Limit`;
            } else if (response.status === 1101) {
                return `❗️ \`${domain}\` - Error`;
            } else {
              return `⚠️ \`${domain}\` - Error ${response.status}`;
            }
          } catch (error) {
            return `❌ \`${domain}\` - Dead/tidak valid`;
          }
        };

        // Batch processing
        const batchSize = 5;
        const results = [];
        for (let i = 0; i < domains.length; i += batchSize) {
            const batch = domains.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(checkDomain));
            results.push(...batchResults);
        }

        const resultText = results.join("\n");
        const message = `🔍 **Hasil Pengecekan Domain:**\n\n${resultText}\n\n**Keterangan:**\n✅ = Domain aktif\n↪️ = Redirect\n🔒 = Limit\n❗️ = Error\n⚠️ = Masalah Lain\n❌ = Dead/tidak valid`;

        await this.editMessage(chatId, messageIdToEdit, message, { parse_mode: "Markdown", ...options });

      } catch (error) {
        console.error("Error in /listdom command:", error);
        await this.editMessage(chatId, messageIdToEdit, "Terjadi kesalahan saat memeriksa domain.", options);
      }
      
      return new Response("OK", { status: 200 });
    }

    // Handle /list command
    if (text.startsWith("/list")) {
      let domains = [];
      try {
        domains = await this.globalBot.getDomainList();
      } catch {}
      
      if (!domains.length) {
        await this.sendMessage(chatId, "No subdomains registered yet.", options);
      } else {
        const listText = domains.map((d, i) => `${i + 1}. ${d}`).join("\n");
        
        await this.sendMessage(
          chatId,
          `📋 LIST WILDCARD BUG :\n\n${listText}\n\n📊 Total: ${domains.length} Wildcard${domains.length > 1 ? "s" : ""}`,
          options
        );
        
        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join("\n");
        await this.sendDocument(chatId, fileContent, "wildcard-list.txt", "text/plain", options);
      }
      
      return new Response("OK", { status: 200 });
    }

    // Handle /approve command
    if (text.startsWith("/approve ")) {
      if (!isOwner) {
        await this.sendMessage(chatId, "Anda tidak berwenang menggunakan perintah ini.", options);
        return new Response("OK", { status: 200 });
      }
      
      const sd = text.split(" ")[1]?.trim();
      if (!sd) return new Response("OK", { status: 200 });
      
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req = this.globalBot.findPendingRequest(sd);
      
      if (!req) {
        await this.sendMessage(chatId, `Tidak ada request pending untuk subdomain ${full}.`, options);
      } else {
        let st = 500;
        try {
          st = await this.globalBot.addSubdomain(sd);
        } catch {}
        
        if (st === 200) {
          this.globalBot.updateRequestStatus(sd, "approved");
          await this.sendMessage(chatId, `✅ Wildcard ${full} disetujui dan ditambahkan.`, options);
          await this.sendMessage(req.requesterId, `✅ Permintaan Wildcard ${full} Anda telah disetujui pada:\n${now}`);
        } else {
          await this.sendMessage(chatId, `❌ Gagal menambahkan domain ${full}, status: ${st}`, options);
        }
      }
      
      return new Response("OK", { status: 200 });
    }

    // Handle /reject command
    if (text.startsWith("/reject ")) {
      if (!isOwner) {
        await this.sendMessage(chatId, "Anda tidak berwenang menggunakan perintah ini.", options);
        return new Response("OK", { status: 200 });
      }
      
      const sd = text.split(" ")[1]?.trim();
      if (!sd) return new Response("OK", { status: 200 });
      
      const full = `${sd}.${this.globalBot.rootDomain}`;
      const req = this.globalBot.findPendingRequest(sd);
      
      if (!req) {
        await this.sendMessage(chatId, `Tidak ada request pending untuk subdomain ${full}.`, options);
      } else {
        this.globalBot.updateRequestStatus(sd, "rejected");
        await this.sendMessage(chatId, `❌ Wildcard ${full} telah ditolak.`, options);
        await this.sendMessage(req.requesterId, `❌ Permintaan Wildcard ${full} Anda telah ditolak pada:\n${now}`);
      }
      
      return new Response("OK", { status: 200 });
    }

    // Handle /req command
    if (text.startsWith("/req")) {
      if (!isOwner) {
        await this.sendMessage(chatId, "Anda tidak berwenang melihat daftar request.", options);
        return new Response("OK", { status: 200 });
      }
      
      const all = this.globalBot.getAllRequests();
      
      if (!all.length) {
        await this.sendMessage(chatId, "Belum ada request subdomain masuk.", options);
      } else {
        let lines = "";
        all.forEach((r, i) => {
          const domain = r.domain;
          const status = r.status;
          const requester = r.requesterUsername;
          const requesterId = r.requesterId.toString();
          const time = r.requestTime;
          
          lines += `${i + 1}. ${domain} — ${status}\n`;
          lines += `   👤 requester: @${requester} (ID: ${requesterId})\n`;
          lines += `   🕒 waktu: ${time}\n\n`;
        });
        
        const message = `📋 Daftar Semua Request:\n\n${lines}`;
        await this.sendMessage(chatId, message, options);
      }
      
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = { chat_id: chatId, text, ...options };
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    return response.json();
  }

  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    
    formData.append("document", blob, filename);
    formData.append("chat_id", String(chatId));
    
    if (options.message_thread_id) {
      formData.append("message_thread_id", String(options.message_thread_id));
    }
    if (options.caption) {
      formData.append("caption", options.caption);
    }
    if (options.parse_mode) {
      formData.append("parse_mode", options.parse_mode);
    }
    if (options.reply_to_message_id) {
      formData.append("reply_to_message_id", String(options.reply_to_message_id));
    }
    
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: "POST",
      body: formData
    });
    
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const body = { chat_id: chatId, message_id: messageId };
    
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
}

// src/bot.js
const HOSTKU = "joss.krekkrek.web.id";
const TelegramBot = class {
  static {
    __name(this, "TelegramBot");
  }
  constructor(token, apiUrl, ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl || "https://api.telegram.org";
    this.ownerId = ownerId;
    this.globalBot = globalBot;
  }
  async handleUpdate(update, ctx) {
    if (!update.message && !update.callback_query) {
      return new Response("OK", { status: 200 });
    }
    if (update.callback_query) {
      const { message, data } = update.callback_query;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      return new Response("OK", { status: 200 });
    }
    if (update.message) {
      const { chat, text: messageText } = update.message;
      const chatId = chat.id;
      const text = messageText?.trim() || "";
      const message_thread_id = update.message.message_thread_id;
      const options = message_thread_id ? { message_thread_id } : {};
      if (text.startsWith("/config")) {
        const helpMsg = ` *PANDUAN CONFIG ROTATE* 

Ketik perintah berikut untuk mendapatkan config rotate berdasarkan negara:

\`rotate + kode_negara\`

Negara tersedia:
id, sg, my, us, ca, in, gb, ir, ae, fi, tr, md, tw, ch, se, nl, es, ru, ro, pl, al, nz, mx, it, de, fr, am, cy, dk, br, kr, vn, th, hk, cn, jp.

Contoh:
\`rotate id\`
\`rotate sg\`
\`rotate my\`

Bot akan memilih IP secara acak dari negara tersebut dan mengirimkan config-nya.`;
        await this.sendMessage(chatId, helpMsg, { parse_mode: "Markdown", ...options });
        return new Response("OK", { status: 200 });
      }
      if (text.startsWith("rotate ")) {
        await rotateconfig.call(this, chatId, text, options, this.globalBot);
        return new Response("OK", { status: 200 });
      }
      if (text.startsWith("/randomconfig")) {
        const loadingMsg = await this.sendMessageWithDelete(chatId, "  Membuat konfigurasi acak...", options);
        try {
          const configText = await randomconfig(this.globalBot);
          await this.sendMessage(chatId, configText, { parse_mode: "Markdown", ...options });
        } catch (error) {
    console.error("Error generating random config:", error);
    await this.sendMessage(chatId, `  Terjadi kesalahan:\n${error.message}`, options);
  }
  if (loadingMsg && loadingMsg.message_id) {
    await this.deleteMessage(chatId, loadingMsg.message_id);
  }
  return new Response("OK", { status: 200 });
}

if (text.startsWith("/listwildcard")) {
  const wildcards = await this.globalBot.getDomainList();
  const configText = `* LIST WILDCARD *


` + wildcards.map((d, i) => `*${i + 1}.* \`${d}\``).join("\n") + `

 *Total:* ${wildcards.length} wildcard

 *Modded By:* [Geo Project](https://t.me/sampiiiiu)`;
  
  await this.sendMessage(chatId, configText, { parse_mode: "Markdown", ...options });
  return new Response("OK", { status: 200 });
}
}
}
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async editMessage(chatId, messageId, text, replyMarkup) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown"
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async sendMessageWithDelete(chatId, text) {
    try {
      const res = await this.sendMessage(chatId, text);
      return res.result;
    } catch (e) {
      console.error("Gagal mengirim pesan:", e);
      return null;
    }
  }
  async deleteMessage(chatId, messageId) {
    const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    return res.json();
  }
};

// src/sublink/sublink.js
const sublinkState = new Map();
const SublinkBuilderBot = class {
  static {
    __name(this, "SublinkBuilderBot");
  }
  constructor(token, apiUrl = "https://api.telegram.org", ownerId, globalBot) {
    this.token = token;
    this.apiUrl = apiUrl;
    this.globalBot = globalBot;
  }
  async handleUpdate(update, ctx) {
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const message_thread_id = update.message.message_thread_id;
      const options = message_thread_id ? { message_thread_id } : {};

      if (text === '/sublink') {
        return this.start(chatId, options);
      }

      const state = sublinkState.get(chatId);
      if (state) {
        if (state.step === 'bug') {
          state.bug = text;
          state.step = 'limit';
          await this.sendMessage(chatId, "Masukkan limit (angka antara 1-20):", options);
        } else if (state.step === 'limit') {
          const limit = parseInt(text, 10);
          if (isNaN(limit) || limit < 1 || limit > 20) {
            await this.sendMessage(chatId, "Input tidak valid. Silakan masukkan angka antara 1 dan 20.", options);
          } else {
            state.limit = limit;
            state.step = 'country';
            const keyboard = {
              inline_keyboard: [
                [{ text: "All Countries", callback_data: "sublink_country_all" }],
                [{ text: "Random", callback_data: "sublink_country_random" }],
                [
                  { text: "Indonesia (ID)", callback_data: "sublink_country_id" },
                  { text: "Singapore (SG)", callback_data: "sublink_country_sg" },
                  { text: "Malaysia (MY)", callback_data: "sublink_country_my" }
                ],
                [
                  { text: "United States (US)", callback_data: "sublink_country_us" },
                  { text: "Japan (JP)", callback_data: "sublink_country_jp" },
                  { text: "South Korea (KR)", callback_data: "sublink_country_kr" }
                ],
                [
                  { text: "Thailand (TH)", callback_data: "sublink_country_th" },
                  { text: "Vietnam (VN)", callback_data: "sublink_country_vn" },
                  { text: "Philippines (PH)", callback_data: "sublink_country_ph" }
                ],
                [
                  { text: "United Kingdom (GB)", callback_data: "sublink_country_gb" },
                  { text: "Germany (DE)", callback_data: "sublink_country_de" },
                  { text: "France (FR)", callback_data: "sublink_country_fr" }
                ],
                [
                  { text: "Brazil (BR)", callback_data: "sublink_country_br" },
                  { text: "India (IN)", callback_data: "sublink_country_in" },
                  { text: "Australia (AU)", callback_data: "sublink_country_au" }
                ],
                [
                  { text: "Canada (CA)", callback_data: "sublink_country_ca" },
                  { text: "Turkey (TR)", callback_data: "sublink_country_tr" },
                  { text: "Netherlands (NL)", callback_data: "sublink_country_nl" }
                ],
                [
                  { text: "Taiwan (TW)", callback_data: "sublink_country_tw" },
                  { text: "Hong Kong (HK)", callback_data: "sublink_country_hk" },
                  { text: "Russia (RU)", callback_data: "sublink_country_ru" }
                ]
              ]
            };
            await this.sendMessage(chatId, "Pilih negara:", { reply_markup: keyboard, ...options });
          }
        }
      }
    }

    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const data = update.callback_query.data;
      const message_thread_id = update.callback_query.message.message_thread_id;
      const options = message_thread_id ? { message_thread_id } : {};
      const state = sublinkState.get(chatId);

      if (!state || !data.startsWith('sublink_')) {
        return new Response("OK", { status: 200 });
      }

      const [_, step, value] = data.split('_');

      if (step === 'app' && state.step === 'app') {
        state.app = value;
        state.step = 'type';
        const keyboard = {
          inline_keyboard: [
            [{ text: "VLESS", callback_data: "sublink_type_vless" }],
            [{ text: "Trojan", callback_data: "sublink_type_trojan" }],
            [{ text: "Shadowsocks", callback_data: "sublink_type_shadowsocks" }]
          ]
        };
        await this.editMessageText(chatId, messageId, "Pilih tipe protokol:", { reply_markup: keyboard, ...options });
      } else if (step === 'type' && state.step === 'type') {
        state.type = value;
        state.step = 'tls';
        const keyboard = {
          inline_keyboard: [
            [{ text: "True", callback_data: "sublink_tls_true" }, { text: "False", callback_data: "sublink_tls_false" }]
          ]
        };
        await this.editMessageText(chatId, messageId, "Gunakan TLS?", { reply_markup: keyboard, ...options });
      } else if (step === 'tls' && state.step === 'tls') {
        state.tls = value;
        state.step = 'wildcard';
        const keyboard = {
          inline_keyboard: [
            [{ text: "True", callback_data: "sublink_wildcard_true" }, { text: "False", callback_data: "sublink_wildcard_false" }]
          ]
        };
        await this.editMessageText(chatId, messageId, "Gunakan Wildcard?", { reply_markup: keyboard, ...options });
      } else if (step === 'wildcard' && state.step === 'wildcard') {
        state.wildcard = value;
        state.step = 'bug';
        await this.editMessageText(chatId, messageId, "Silakan kirimkan bug host Anda (contoh: ava.game.naver.com):", options);
      } else if (step === 'country' && state.step === 'country') {
        state.country = value;
        
        // Simpan messageId yang akan dihapus nanti
        state.processingMessageId = messageId;
        
        await this.editMessageText(chatId, messageId, "Sedang memproses permintaan Anda...", options);
        
        // Build URL berdasarkan pilihan country
        const randomHost = this.globalBot.getRandomHost();
        let url;
        if (state.country === "all") {
          url = `https://${randomHost}/vpn/${state.app}?type=${state.type}&bug=${state.bug}&tls=${state.tls}&wildcard=${state.wildcard}&limit=${state.limit}`;
        } else if (state.country === "random") {
          url = `https://${randomHost}/vpn/${state.app}?type=${state.type}&bug=${state.bug}&tls=${state.tls}&wildcard=${state.wildcard}&limit=${state.limit}&country=random`;
        } else {
          url = `https://${randomHost}/vpn/${state.app}?type=${state.type}&bug=${state.bug}&tls=${state.tls}&wildcard=${state.wildcard}&limit=${state.limit}&country=${state.country}`;
        }
        
        console.log(`Mengakses URL: ${url}`); // Untuk debugging
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Gagal mengambil data dari URL: ${response.statusText}`);
          }
          const content = await response.text();
          
          // Cek jika content kosong atau error
          if (!content || content.trim() === '') {
            throw new Error('Tidak ada data yang diterima dari server');
          }
          
          // Buat caption dengan format link yang bisa diklik
          let countryDisplay;
          if (state.country === 'all') {
            countryDisplay = 'All Countries';
          } else if (state.country === 'random') {
            countryDisplay = 'Random Country';
          } else {
            countryDisplay = state.country.toUpperCase();
          }

          const caption = `🔗 <b>Sub Link Berhasil Dibuat!</b>

📱 <b>Aplikasi:</b> <code>${state.app}</code>
🔧 <b>Tipe:</b> <code>${state.type}</code>
🐛 <b>Bug:</b> <code>${state.bug}</code>
🔒 <b>TLS:</b> <code>${state.tls}</code>
🎯 <b>Wildcard:</b> <code>${state.wildcard}</code>
📊 <b>Limit:</b> <code>${state.limit}</code>
🌍 <b>Country:</b> <code>${countryDisplay}</code>

👇 <b>Klik link di bawah untuk copy:</b>
<a href="${url}">${url}</a>`;
          
          // Hapus pesan "Sedang memproses permintaan Anda..."
          await this.deleteMessage(chatId, state.processingMessageId);
          
          // Kirim dokumen dengan hasil
          await this.sendDocument(chatId, content, "sublink.txt", "text/plain", { 
            caption: caption,
            parse_mode: "HTML",
            ...options
          });
        } catch (error) {
          console.error('Error:', error);
          
          // Hapus pesan "Sedang memproses permintaan Anda..." meski ada error
          await this.deleteMessage(chatId, state.processingMessageId);
          
          // Kirim pesan error
          await this.sendMessage(chatId, `❌ <b>Terjadi Kesalahan</b>\n\n${error.message}\n\nSilakan coba lagi dengan parameter yang berbeda.`, {
            parse_mode: "HTML",
            ...options
          });
        } finally {
          sublinkState.delete(chatId);
        }
      }
    }
    return new Response("OK", { status: 200 });
  }
  async start(chatId, options = {}) {
    sublinkState.set(chatId, { step: 'app' });
    const keyboard = {
      inline_keyboard: [
        [{ text: "V2Ray", callback_data: "sublink_app_v2ray" }, { text: "Clash", callback_data: "sublink_app_clash" }],
        [{ text: "Nekobox", callback_data: "sublink_app_nekobox" }, { text: "Singbox", callback_data: "sublink_app_singbox" }],
        [{ text: "Surfboard", callback_data: "sublink_app_surfboard" }]
      ]
    };
    await this.sendMessage(chatId, "Silakan pilih aplikasi:", { reply_markup: keyboard, ...options });
    return new Response("OK", { status: 200 });
  }
  async sendMessage(chatId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async editMessageText(chatId, messageId, text, options = {}) {
    const url = `${this.apiUrl}/bot${this.token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      ...options
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }
  async sendDocument(chatId, content, filename, mimeType, options = {}) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append("document", blob, filename);
    formData.append("chat_id", String(chatId));
    if (options.message_thread_id) {
      formData.append("message_thread_id", String(options.message_thread_id));
    }
    if (options.caption) {
      formData.append("caption", options.caption);
    }
    if (options.parse_mode) {
      formData.append("parse_mode", options.parse_mode);
    }
    if (options.reply_to_message_id) {
      formData.append("reply_to_message_id", String(options.reply_to_message_id));
    }
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: "POST",
      body: formData
    });
    return response.json();
  }
  async deleteMessage(chatId, messageId) {
    try {
      const url = `${this.apiUrl}/bot${this.token}/deleteMessage`;
      const body = { chat_id: chatId, message_id: messageId };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!result.ok) {
        console.warn('Gagal menghapus pesan:', result);
      }
      return result;
    } catch (error) {
      console.error('Error saat menghapus pesan:', error);
    }
  }
};

// src/worker.js
const worker_default = {
  async isUserMember(userId, token) {
    const groupId = "@auto_sc";
    const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${groupId}&user_id=${userId}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.ok) {
        const status = data.result.status;
        return status === 'member' || status === 'administrator' || status === 'creator';
      }
    } catch (error) {
      console.error("Error checking group membership:", error);
    }
    return false;
  },

  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    try {
      const update = await request.json();
      const token = "7664381872:AAFBZquRrIqh7jALwv6-hkcb-ZXMrjqLMB0";
      const ownerId = 1467883032;
      const groupId = "@auto_sc";

      let userId;
      let chatId;
      if (update.message) {
        userId = update.message.from.id;
        chatId = update.message.chat.id;
      } else if (update.callback_query) {
        userId = update.callback_query.from.id;
        chatId = update.callback_query.message.chat.id;
      }

      if (userId && userId.toString() !== ownerId.toString()) {
        const isMember = await this.isUserMember(userId, token);
        if (!isMember) {
          const message = `Untuk mengakses bot ini, Anda harus bergabung dengan grup kami terlebih dahulu.`;
          const keyboard = {
            inline_keyboard: [
              [{ text: "Gabung Grup", url: `https://t.me/auto_sc` }]
            ]
          };
          const url = `https://api.telegram.org/bot${token}/sendMessage`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, reply_markup: keyboard })
          });
          return new Response("OK", { status: 200 });
        }
      }

      if (update.message) {
        const chat = update.message.chat;
        const username = chat.username || chat.first_name || "N/A";
        const allUsers = await env.GEO_DB.get("broadcast_users", { type: "json" }) || [];
        const userExists = allUsers.some((user) => (typeof user === "object" ? user.id : user) === chatId);
        if (!userExists) {
          allUsers.push({ id: chatId, username });
          await env.GEO_DB.put("broadcast_users", JSON.stringify(allUsers));
        }
      }

      const apiKey = "28595cd826561d8014059ca54712d3ca3332c";
      const accountID = "716746bfb7638b3aaa909b55740fbc60";
      const apiEmail = "pihajamal@gmail.com";
      const serviceName = "joss";
      const zones = [
        { rootDomain: "krekkrek.web.id", zoneID: "fe34f9ac955252fedff0a3907333b456" },
        { rootDomain: "krukkruk.web.id", zoneID: "fe34f9ac955252fedff0a3907333b456" },
        { rootDomain: "krikkrik.web.id", zoneID: "fe34f9ac955252fedff0a3907333b456" },
        { rootDomain: "krokkrok.web.id", zoneID: "fe34f9ac955252fedff0a3907333b456" },
        { rootDomain: "gpj2.dpdns.org", zoneID: "fe34f9ac955252fedff0a3907333b456" }
      ];
      const globalBot = new KonstantaGlobalbot({
        apiKey,
        accountID,
        zones,
        apiEmail,
        serviceName
      });
      let bot;
      if (update.callback_query) {
        const data = update.callback_query.data;
        if (data.startsWith("userlist_page_")) {
          bot = new Converterbot(token, "https://api.telegram.org", ownerId, env);
        } else if (data.startsWith("randomip_page_") || data.startsWith("cc_") || data.startsWith("show_text_") || data.startsWith("download_file_")) {
          bot = new TelegramBotku(token, "https://api.telegram.org", ownerId, env);
        } else if (data.startsWith("PROTOCOL|") || data.startsWith("SHOW_WILDCARD|") || data.startsWith("NOWILDCARD|") || data.startsWith("WILDCARD|") || data.startsWith("BACK|") || data.startsWith("BACK_WILDCARD|")) {
          bot = new TelegramProxyCekBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (data.startsWith("page_") || data.startsWith("select_") || data.startsWith("config_")) {
          bot = new TelegramProxyBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (data.startsWith("sublink_")) {
          bot = new SublinkBuilderBot(token, "https://api.telegram.org", ownerId, globalBot);
        }
      } else if (update.message && update.message.text) {
        const commandParts = update.message.text.trim().split(" ");
        commandParts[0] = commandParts[0].split("@")[0];
        update.message.text = commandParts.join(" ");
        const text = update.message.text;
        if (text.startsWith("/listdom")) {
          const listdomBot = new TelegramWildcardBot(token, "https://api.telegram.org", ownerId, globalBot);
          ctx.waitUntil(listdomBot.handleUpdate(update));
          return new Response("OK", { status: 200 });
        }
        const chatId = update.message.chat.id;
        if (sublinkState.has(chatId)) {
          bot = new SublinkBuilderBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (text.startsWith("/config") || text.startsWith("rotate ") || text.startsWith("/randomconfig") || text.startsWith("/listwildcard")) {
          bot = new TelegramBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (text.startsWith("/proxyip")) {
          bot = new TelegramProxyBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (text.startsWith("/proxy") || text.startsWith("/menu") || text.startsWith("/findproxy") || text.startsWith("/donate") || text.startsWith("/stats") || text.startsWith("/start") || text.startsWith("/ping") || text.startsWith("/kuota")) {
          bot = new TelegramBotku(token, "https://api.telegram.org", ownerId, env, globalBot);
        } else if (text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):?(\d{1,5})?$/) && !text.includes("://")) {
          bot = new TelegramProxyCekBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (text.startsWith("/add") || text.startsWith("/del") || text.startsWith("/list") || text.startsWith("/approve ") || text.startsWith("/reject ") || text.startsWith("/req")) {
          bot = new TelegramWildcardBot(token, "https://api.telegram.org", ownerId, globalBot);
        } else if (text.startsWith("/broadcast") || text.startsWith("/userlist") || text.startsWith("/converter") || text.includes("://")) {
          bot = new Converterbot(token, "https://api.telegram.org", ownerId, env);
        } else if (text.startsWith("/sublink")) {
          bot = new SublinkBuilderBot(token, "https://api.telegram.org", ownerId, globalBot);
        }
      }
      if (bot) {
        await bot.handleUpdate(update, ctx);
      }
      return new Response("OK", { status: 200 });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
};
export {
  worker_default as default
};
