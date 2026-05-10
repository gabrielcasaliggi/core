import type { NetworkSnapshot, WanInterface, FirewallLog, VpnUser, ProvisioningTemplate, ProvisioningJob } from "@/types/telemetry";

export const MOCK_NETWORK_SNAPSHOT: NetworkSnapshot = {
  timestamp: new Date().toISOString(),
  globalResilienceScore: 87,
  sites: [
    // ── Casa Central (Batán, BA Province) ──────────────────────────────
    {
      id: "site-hq",
      name: "Casa Central",
      shortName: "HQ",
      type: "headquarters",
      coords: { lat: -37.72, lng: -57.68 },
      status: "operational",
      resilienceScore: 96,
      connectedDevices: 142,
      activeUsers: 89,
      firewallEnabled: true,
      lastUpdated: new Date().toISOString(),
      links: [
        {
          id: "link-hq-fiber-1",
          type: "fiber",
          provider: "Telecom Argentina",
          status: "active",
          latencyMs: 4,
          bandwidthMbps: 1000,
          usageMbps: 312,
          uptimePercent: 99.97,
        },
        {
          id: "link-hq-radio-1",
          type: "radiolink",
          provider: "Movistar",
          status: "active",
          latencyMs: 12,
          bandwidthMbps: 100,
          usageMbps: 20,
          uptimePercent: 99.5,
        },
        {
          id: "link-hq-starlink",
          type: "starlink",
          provider: "Starlink",
          status: "standby",
          latencyMs: 0,
          bandwidthMbps: 200,
          usageMbps: 0,
          uptimePercent: 98.5,
        },
      ],
      vpnTunnels: [
        { id: "vpn-hq-obrador", targetSiteId: "site-obrador", protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 18 },
        { id: "vpn-hq-studio",  targetSiteId: "site-studio",  protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 22 },
        { id: "vpn-hq-sucursal",targetSiteId: "site-sucursal",protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 14 },
      ],
    },

    // ── Obrador (Mar del Plata) ────────────────────────────────────────
    {
      id: "site-obrador",
      name: "Obrador",
      shortName: "OBR",
      type: "remote",
      coords: { lat: -38.00, lng: -57.55 },
      status: "degraded",
      resilienceScore: 71,
      connectedDevices: 34,
      activeUsers: 22,
      firewallEnabled: true,
      lastUpdated: new Date().toISOString(),
      links: [
        {
          id: "link-obrador-radio",
          type: "radiolink",
          provider: "Personal",
          status: "failed",
          latencyMs: 0,
          bandwidthMbps: 50,
          usageMbps: 0,
          uptimePercent: 72.3,
        },
        {
          id: "link-obrador-starlink",
          type: "starlink",
          provider: "Starlink",
          status: "active",
          latencyMs: 38,
          bandwidthMbps: 200,
          usageMbps: 85,
          uptimePercent: 98.2,
        },
      ],
      vpnTunnels: [
        { id: "vpn-obrador-hq", targetSiteId: "site-hq", protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 18 },
      ],
    },

    // ── Estudio Jurídico (Buenos Aires) ────────────────────────────────
    {
      id: "site-studio",
      name: "Estudio Jurídico",
      shortName: "EST",
      type: "studio",
      coords: { lat: -34.62, lng: -58.40 },
      status: "operational",
      resilienceScore: 94,
      connectedDevices: 28,
      activeUsers: 15,
      firewallEnabled: true,
      lastUpdated: new Date().toISOString(),
      links: [
        {
          id: "link-studio-fiber",
          type: "fiber",
          provider: "Telecom Argentina",
          status: "active",
          latencyMs: 6,
          bandwidthMbps: 300,
          usageMbps: 94,
          uptimePercent: 99.8,
        },
        {
          id: "link-studio-starlink",
          type: "starlink",
          provider: "Starlink",
          status: "standby",
          latencyMs: 0,
          bandwidthMbps: 150,
          usageMbps: 0,
          uptimePercent: 97.9,
        },
      ],
      vpnTunnels: [
        { id: "vpn-studio-hq", targetSiteId: "site-hq", protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 22 },
      ],
    },

    // ── Sucursal (La Plata) ───────────────────────────────────────────
    {
      id: "site-sucursal",
      name: "Sucursal",
      shortName: "SUC",
      type: "branch",
      coords: { lat: -34.90, lng: -57.95 },
      status: "operational",
      resilienceScore: 88,
      connectedDevices: 45,
      activeUsers: 31,
      firewallEnabled: true,
      lastUpdated: new Date().toISOString(),
      links: [
        {
          id: "link-sucursal-fiber",
          type: "fiber",
          provider: "Movistar",
          status: "active",
          latencyMs: 8,
          bandwidthMbps: 500,
          usageMbps: 210,
          uptimePercent: 99.6,
        },
        {
          id: "link-sucursal-radio",
          type: "radiolink",
          provider: "Movistar",
          status: "standby",
          latencyMs: 0,
          bandwidthMbps: 100,
          usageMbps: 0,
          uptimePercent: 99.1,
        },
      ],
      vpnTunnels: [
        { id: "vpn-sucursal-hq", targetSiteId: "site-hq", protocol: "WireGuard", status: "active", encryptionBits: 256, latencyMs: 14 },
      ],
    },
  ],

  // ── Mesh flows (all pairs) ────────────────────────────────────────────
  flows: [
    { id: "flow-hq-studio-fiber",      sourceId: "site-hq",       targetId: "site-studio",   throughputMbps: 94.0,  protocol: "VPN", connectionType: "fiber",     encrypted: true,  congested: false },
    { id: "flow-hq-obrador-starlink",  sourceId: "site-hq",       targetId: "site-obrador",  throughputMbps: 45.2,  protocol: "VPN", connectionType: "starlink",  encrypted: true,  congested: false },
    { id: "flow-hq-sucursal-fiber",    sourceId: "site-hq",       targetId: "site-sucursal", throughputMbps: 71.5,  protocol: "VPN", connectionType: "fiber",     encrypted: true,  congested: false },
    { id: "flow-studio-sucursal-fiber",sourceId: "site-studio",   targetId: "site-sucursal", throughputMbps: 28.7,  protocol: "VPN", connectionType: "fiber",     encrypted: true,  congested: false },
    { id: "flow-hq-obrador-radio",     sourceId: "site-hq",       targetId: "site-obrador",  throughputMbps: 0,     protocol: "VPN", connectionType: "radiolink", encrypted: true,  congested: false },
    { id: "flow-obrador-sucursal-star",sourceId: "site-obrador",  targetId: "site-sucursal", throughputMbps: 18.3,  protocol: "VPN", connectionType: "starlink",  encrypted: true,  congested: false },
  ],

  activeAlerts: [
    {
      id: "alert-001",
      siteId: "site-obrador",
      severity: "warning",
      message: "Detectada falla masiva en enlace Radio (Personal). ¿Desea mover 100% arquitectura a espejo soberano satelital?",
      timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
      acknowledged: false,
    },
    {
      id: "alert-002",
      siteId: "site-obrador",
      severity: "info",
      message: "Latencia Starlink incrementada: 38ms (umbral: 50ms)",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      acknowledged: false,
    },
  ],
};

export function getResilienceColor(score: number): string {
  if (score >= 90) return "#10B981";   // Emerald Phosphor — OK
  if (score >= 70) return "#F59E0B";   // Amber — Warning
  return "#F43F5E";                    // Neon Rose — Critical
}

export function getSiteStatusColor(status: string): string {
  const map: Record<string, string> = {
    operational: "#10B981",   // Emerald Phosphor
    degraded:    "#F59E0B",   // Amber
    critical:    "#F43F5E",   // Neon Rose
    offline:     "#475569",   // Slate
  };
  return map[status] ?? "#475569";
}

export function getLinkTypeLabel(type: string): string {
  const map: Record<string, string> = {
    fiber:     "Fibra Óptica",
    radiolink: "Radioenlace",
    starlink:  "Starlink",
    vpn:       "VPN",
  };
  return map[type] ?? type;
}

// ── WAN Interfaces (mapeadas a los enlaces de los sitios) ─────────────────────
// Cuando se integre RouterOS: /interface ethernet print + /ip address print

export const MOCK_WAN_INTERFACES: WanInterface[] = [
  {
    interface:         "ether1",
    name:              "WAN Principal — Movistar Fibra",
    publicIP:          "200.45.67.89",
    status:            "up",
    latencyMs:         8,
    throughputRxMbps:  94.2,
    throughputTxMbps:  12.4,
    bandwidthMbps:     300,
    provider:          "Movistar",
    type:              "fiber",
    isPrimary:         true,
    siteId:            "site-hq",
    uptimePercent:     99.8,
  },
  {
    interface:         "ether2",
    name:              "WAN Backup — Starlink",
    publicIP:          "100.77.214.5",
    status:            "up",
    latencyMs:         42,
    throughputRxMbps:  28.6,
    throughputTxMbps:  5.1,
    bandwidthMbps:     100,
    provider:          "Starlink",
    type:              "starlink",
    isPrimary:         false,
    siteId:            "site-hq",
    uptimePercent:     98.1,
  },
  {
    interface:         "ether1",
    name:              "WAN — Radioenlace punto a punto",
    publicIP:          "192.168.100.1",
    status:            "up",
    latencyMs:         3,
    throughputRxMbps:  45.0,
    throughputTxMbps:  8.7,
    bandwidthMbps:     100,
    provider:          "Radioenlace WISP",
    type:              "radiolink",
    isPrimary:         true,
    siteId:            "site-obrador",
    uptimePercent:     97.4,
  },
  {
    interface:         "ether1",
    name:              "WAN — Fibertel Business",
    publicIP:          "170.210.34.112",
    status:            "up",
    latencyMs:         11,
    throughputRxMbps:  87.3,
    throughputTxMbps:  22.1,
    bandwidthMbps:     200,
    provider:          "Fibertel Business",
    type:              "fiber",
    isPrimary:         true,
    siteId:            "site-studio",
    uptimePercent:     99.2,
  },
  {
    interface:         "ether2",
    name:              "WAN Backup — Starlink",
    publicIP:          "100.99.8.201",
    status:            "down",
    latencyMs:         0,
    throughputRxMbps:  0,
    throughputTxMbps:  0,
    bandwidthMbps:     100,
    provider:          "Starlink",
    type:              "starlink",
    isPrimary:         false,
    siteId:            "site-sucursal",
    uptimePercent:     91.3,
  },
];

// ── Logs de Firewall ──────────────────────────────────────────────────────────
// Cuando se integre RouterOS: /log print where topics~"firewall"

const T = (minAgo: number) =>
  new Date(Date.now() - minAgo * 60 * 1000).toISOString();

export const MOCK_FIREWALL_LOGS: FirewallLog[] = [
  { id: "fw-001", timestamp: T(2),   srcIP: "45.146.164.231",  dstIP: "200.45.67.89",    protocol: "TCP",   dstPort: 22,   action: "drop",   chain: "input",   threat: "bruteforce", severity: "critical", siteId: "site-hq",      country: "RU" },
  { id: "fw-002", timestamp: T(4),   srcIP: "192.168.1.254",   dstIP: "10.0.0.5",         protocol: "TCP",   dstPort: 443,  action: "drop",   chain: "forward", threat: "c2-beacon",  severity: "critical", siteId: "site-hq"                },
  { id: "fw-003", timestamp: T(7),   srcIP: "185.220.101.3",   dstIP: "200.45.67.89",    protocol: "TCP",   dstPort: 3389, action: "drop",   chain: "input",   threat: "bruteforce", severity: "critical", siteId: "site-hq",      country: "DE" },
  { id: "fw-004", timestamp: T(12),  srcIP: "103.75.191.82",   dstIP: "200.45.67.89",    protocol: "UDP",   dstPort: 500,  action: "drop",   chain: "input",   threat: "portscan",   severity: "warning",  siteId: "site-hq",      country: "CN" },
  { id: "fw-005", timestamp: T(15),  srcIP: "91.108.4.102",    dstIP: "200.45.67.89",    protocol: "TCP",   dstPort: 80,   action: "drop",   chain: "input",   threat: "malware",    severity: "warning",  siteId: "site-studio",  country: "NL" },
  { id: "fw-006", timestamp: T(22),  srcIP: "5.188.206.14",    dstIP: "200.45.67.89",    protocol: "ICMP",  dstPort: 0,    action: "drop",   chain: "input",   threat: "ddos",       severity: "critical", siteId: "site-hq",      country: "UA" },
  { id: "fw-007", timestamp: T(31),  srcIP: "141.98.10.56",    dstIP: "170.210.34.112",  protocol: "TCP",   dstPort: 8080, action: "drop",   chain: "input",   threat: "portscan",   severity: "info",     siteId: "site-studio",  country: "BR" },
  { id: "fw-008", timestamp: T(45),  srcIP: "223.111.73.6",    dstIP: "200.45.67.89",    protocol: "TCP",   dstPort: 23,   action: "reject", chain: "input",   threat: "geo-block",  severity: "info",     siteId: "site-hq",      country: "CN" },
  { id: "fw-009", timestamp: T(58),  srcIP: "77.222.42.1",     dstIP: "200.45.67.89",    protocol: "UDP",   dstPort: 1194, action: "drop",   chain: "input",   threat: "portscan",   severity: "info",     siteId: "site-hq",      country: "RO" },
  { id: "fw-010", timestamp: T(72),  srcIP: "195.54.160.43",   dstIP: "192.168.100.1",   protocol: "TCP",   dstPort: 22,   action: "drop",   chain: "input",   threat: "bruteforce", severity: "warning",  siteId: "site-obrador", country: "DE" },
];

// ── Usuarios VPN activos ──────────────────────────────────────────────────────
// Cuando se integre RouterOS: /ppp active print

// ── Plantillas de configuración RouterOS ─────────────────────────────────────

export const PROVISIONING_TEMPLATES: ProvisioningTemplate[] = [
  {
    id: "tpl-fiber-branch",
    name: "Sucursal Fibra — Estándar",
    description: "Fibra primaria + Starlink backup. Firewall corporativo, VPN WireGuard al HQ, QoS 3 capas.",
    hardware: ["MikroTik RB4011", "MikroTik hEX S"],
    wanType: "fiber",
    features: ["Firewall Corporativo", "VPN WireGuard", "Failover Automático", "QoS 3 capas", "DHCP Server"],
    estimatedSeconds: 95,
  },
  {
    id: "tpl-starlink-remote",
    name: "Sitio Remoto — Starlink",
    description: "Starlink como único enlace. Ideal para obradores y sitios sin infraestructura fija. VPN IPsec.",
    hardware: ["MikroTik hEX S", "MikroTik RB760iGS"],
    wanType: "starlink",
    features: ["Firewall Básico", "VPN IPsec", "Starlink MTU optimizado", "DHCP Server"],
    estimatedSeconds: 60,
  },
  {
    id: "tpl-radiolink-field",
    name: "Obrador — Radioenlace",
    description: "Radioenlace punto a punto. Configuración optimizada para baja latencia y alta disponibilidad en campo.",
    hardware: ["MikroTik RB760iGS", "MikroTik hEX S"],
    wanType: "radiolink",
    features: ["Firewall Básico", "VPN WireGuard", "QoS Prioridad VoIP", "Routing dinámico OSPF"],
    estimatedSeconds: 75,
  },
  {
    id: "tpl-hq-full",
    name: "Casa Central — Full Stack",
    description: "Configuración completa para sede principal. Dual WAN, firewall avanzado, SD-WAN orchestration, BGP.",
    hardware: ["MikroTik CCR2004", "MikroTik RB4011"],
    wanType: "fiber",
    features: ["Firewall Avanzado + IDS", "SD-WAN Activo/Pasivo", "BGP eBGP", "VPN Hub", "QoS 5 capas", "VLAN Segmentación"],
    estimatedSeconds: 180,
  },
];

// ── Historial de provisionings realizados ─────────────────────────────────────

const J = (minAgo: number) => new Date(Date.now() - minAgo * 60 * 1000).toISOString();

export const MOCK_PROVISIONING_HISTORY: ProvisioningJob[] = [
  {
    id: "job-001",
    siteId: "site-hq",
    siteName: "Casa Central",
    templateId: "tpl-hq-full",
    hardware: "MikroTik CCR2004",
    status: "success",
    startedAt: J(20160),
    completedAt: J(20157),
    steps: [
      { label: "Conectar a RouterOS",    command: "/system identity print",                    status: "success", log: "identity: casa-central-gw01" },
      { label: "Aplicar firewall",       command: "/ip firewall filter import tpl-fw.rsc",     status: "success", log: "14 rules imported" },
      { label: "Configurar WireGuard",   command: "/interface wireguard import tpl-wg.rsc",    status: "success", log: "peer added: site-studio" },
      { label: "QoS 5 capas",           command: "/queue tree import tpl-qos.rsc",             status: "success", log: "5 queues created" },
      { label: "Verificar conectividad", command: "/tool ping 8.8.8.8 count=3",               status: "success", log: "3 packets OK, avg 8ms" },
    ],
  },
  {
    id: "job-002",
    siteId: "site-sucursal",
    siteName: "Sucursal La Plata",
    templateId: "tpl-fiber-branch",
    hardware: "MikroTik RB4011",
    status: "success",
    startedAt: J(2880),
    completedAt: J(2878),
    steps: [
      { label: "Conectar a RouterOS",    command: "/system identity print",                    status: "success", log: "identity: sucursal-gw01" },
      { label: "Aplicar firewall",       command: "/ip firewall filter import tpl-fw.rsc",     status: "success", log: "12 rules imported" },
      { label: "Configurar WireGuard",   command: "/interface wireguard import tpl-wg.rsc",    status: "success", log: "peer added: site-hq" },
      { label: "Failover Starlink",      command: "/ip route import tpl-failover.rsc",         status: "success", log: "backup route via ether2" },
      { label: "Verificar conectividad", command: "/tool ping 8.8.8.8 count=3",               status: "success", log: "3 packets OK, avg 11ms" },
    ],
  },
];

export const MOCK_VPN_USERS: VpnUser[] = [
  {
    id:          "vpn-u001",
    username:    "gabriel.rodriguez",
    realIP:      "186.23.45.67",
    virtualIP:   "10.0.100.2",
    connectedAt: T(185),
    rxBytes:     1_420_800_000,
    txBytes:     280_500_000,
    protocol:    "WireGuard",
    status:      "active",
    siteId:      "site-hq",
  },
  {
    id:          "vpn-u002",
    username:    "marta.soria",
    realIP:      "190.32.111.8",
    virtualIP:   "10.0.100.3",
    connectedAt: T(42),
    rxBytes:     540_000_000,
    txBytes:     95_200_000,
    protocol:    "WireGuard",
    status:      "active",
    siteId:      "site-hq",
  },
  {
    id:          "vpn-u003",
    username:    "carlos.benitez",
    realIP:      "200.64.18.222",
    virtualIP:   "10.0.100.4",
    connectedAt: T(320),
    rxBytes:     2_100_000_000,
    txBytes:     890_000_000,
    protocol:    "L2TP",
    status:      "idle",
    siteId:      "site-studio",
  },
  {
    id:          "vpn-u004",
    username:    "directorio.ceo",
    realIP:      "181.46.90.155",
    virtualIP:   "10.0.100.5",
    connectedAt: T(15),
    rxBytes:     88_000_000,
    txBytes:     12_400_000,
    protocol:    "IPsec",
    status:      "active",
    siteId:      "site-hq",
  },
];
