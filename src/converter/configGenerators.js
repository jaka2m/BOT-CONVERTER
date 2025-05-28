import { parseV2RayLink } from './linkParser.js';

export function generateClashConfig(links, isFullConfig = false) {
  const parsedLinks = links.map(link => parseV2RayLink(link));
  
  let config = `# Clash Configuration\n# Generated at: ${new Date().toISOString()}\n\n`;
  
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
  ⛔ ADS:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_basicads.yaml"
    path: "./rule_provider/rule_basicads.yaml"
    interval: 86400

  🔞 Porn:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_porn.yaml"
    path: "./rule_provider/rule_porn.yaml"
    interval: 86400

`;
  }
  
  config += `proxies:\n`;
  
  parsedLinks.forEach(link => {
    config += `  - name: "${link.name}"\n`;
    config += `    type: ${link.type}\n`;
    config += `    server: ${link.server}\n`;
    config += `    port: ${link.port}\n`;
    
    if (link.type === 'vmess') {
      config += `    uuid: ${link.uuid}\n`;
      config += `    alterId: ${link.alterId}\n`;
      config += `    cipher: ${link.cipher}\n`;
    } else if (link.type === 'vless') {
      config += `    uuid: ${link.uuid}\n`;
    } else if (link.type === 'trojan') {
      config += `    password: ${link.password}\n`;
    } else if (link.type === 'ss') {
      config += `    cipher: ${link.cipher}\n`;
      config += `    password: ${link.password}\n`;
    }
    
    config += `    udp: true\n`;
    
    if (link.tls) {
      config += `    tls: true\n`;
      config += `    skip-cert-verify: ${link.skipCertVerify}\n`;
      if (link.sni) {
        config += `    servername: ${link.sni}\n`;
      }
    }
    
    if (link.network === 'ws') {
      config += `    network: ws\n`;
      config += `    ws-opts:\n`;
      config += `      path: "${link.wsPath}"\n`;
      if (link.wsHost) {
        config += `      headers:\n`;
        config += `        Host: "${link.wsHost}"\n`;
      }
    }
    
    config += '\n';
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
      - "REJECT"\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
    });
    
    config += `
  - name: "BEST-PING"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
    });
    
    config += `
  - name: "BALANCED"
    type: load-balance
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
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
  - RULE-SET,⛔ ADS,ADS
  - RULE-SET,🔞 Porn,PORN
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - MATCH,INTERNET\n`;
  }
  
  return config;
}

export function generateNekoboxConfig(links, isFullConfig = false) {
  const parsedLinks = links.map(link => parseV2RayLink(link));
  
  let config = isFullConfig 
    ? `{
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
        "Best Latency",\n`
    : `{
  "outbounds": [\n`;
  
  // Add proxy tags for selector
  parsedLinks.forEach(link => {
    config += `        "${link.name}",\n`;
  });
  
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [\n`;
    
    parsedLinks.forEach(link => {
      config += `        "${link.name}",\n`;
    });
    
    config += `        "direct"
      ],
      "url": "https://detectportal.firefox.com/success.txt",
      "interval": "1m0s"
    },\n`;
  }
  
  // Add proxy configurations
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ',\n';
    
    config += `    {\n`;
    config += `      "tag": "${link.name}",\n`;
    
    if (link.type === 'vmess') {
      config += `      "type": "vmess",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "alter_id": ${link.alterId || 0},\n`;
      config += `      "security": "${link.cipher || "auto"}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    } 
    else if (link.type === 'vless') {
      config += `      "type": "vless",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "flow": "",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'trojan') {
      config += `      "type": "trojan",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'ss') {
      config += `      "type": "shadowsocks",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "method": "${link.cipher || "none"}",\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "plugin": "v2ray-plugin",\n`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"\n`;
    }
    
    config += `    }`;
  });
  
  if (isFullConfig) {
    config += `,\n    {
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
    config += `\n  ]
}`;
  }
  
  return config;
}

export function generateSingboxConfig(links, isFullConfig = false) {
  const parsedLinks = links.map(link => parseV2RayLink(link));
  
  let config = isFullConfig 
    ? `{
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
        "Best Latency",\n`
    : `{
  "outbounds": [\n`;
  
  // Add proxy tags for selector
  parsedLinks.forEach(link => {
    config += `        "${link.name}",\n`;
  });
  
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [\n`;
    
    parsedLinks.forEach(link => {
      config += `        "${link.name}",\n`;
    });
    
    config += `        "direct"
      ],
      "url": "https://www.google.com",
      "interval": "10s"
    },\n`;
  }
  
  // Add proxy configurations
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ',\n';
    
    config += `    {\n`;
    config += `      "tag": "${link.name}",\n`;
    
    if (link.type === 'vmess') {
      config += `      "type": "vmess",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "alter_id": ${link.alterId || 0},\n`;
      config += `      "security": "${link.cipher || "zero"}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    } 
    else if (link.type === 'vless') {
      config += `      "type": "vless",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'trojan') {
      config += `      "type": "trojan",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'ss') {
      config += `      "type": "shadowsocks",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "method": "${link.cipher || "none"}",\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "plugin": "v2ray-plugin",\n`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"\n`;
    }
    
    config += `    }`;
  });
  
  if (isFullConfig) {
    config += `,\n    {
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
    config += `\n  ]
}`;
  }
  
  return config;
}
