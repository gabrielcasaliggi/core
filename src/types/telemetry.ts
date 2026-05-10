export type SiteStatus = "operational" | "degraded" | "critical" | "offline";
export type LinkType = "fiber" | "radiolink" | "starlink" | "vpn";
export type LinkStatus = "active" | "standby" | "failed";

export interface GeoCoords {
  lat: number;
  lng: number;
}

export interface Link {
  id: string;
  type: LinkType;
  provider: string;
  status: LinkStatus;
  latencyMs: number;
  bandwidthMbps: number;
  usageMbps: number;
  uptimePercent: number;
}

export interface VPNTunnel {
  id: string;
  targetSiteId: string;
  protocol: "L2TP" | "WireGuard" | "OpenVPN" | "IPsec";
  status: LinkStatus;
  encryptionBits: 128 | 256;
  latencyMs: number;
}

export interface Site {
  id: string;
  name: string;
  shortName: string;
  type: "headquarters" | "branch" | "remote" | "studio";
  coords: GeoCoords;
  status: SiteStatus;
  resilienceScore: number;
  links: Link[];
  vpnTunnels: VPNTunnel[];
  connectedDevices: number;
  activeUsers: number;
  firewallEnabled: boolean;
  lastUpdated: string;
}

export interface DataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  throughputMbps: number;
  protocol: "MPLS" | "VPN" | "SD-WAN" | "Direct";
  connectionType: "fiber" | "radiolink" | "starlink";
  encrypted: boolean;
  congested?: boolean;
}

export interface NetworkSnapshot {
  timestamp: string;
  globalResilienceScore: number;
  sites: Site[];
  flows: DataFlow[];
  activeAlerts: Alert[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  siteId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export type MissionMode = "normal" | "contingency" | "lockdown";
export type ViewId = "resiliencia" | "sdwan" | "bunker" | "nexus" | "teletrabajo" | "provisioning";

export type ClaimStatus = "idle" | "sending" | "sent" | "error";

// ── Interfaces WAN (RouterOS: /interface ethernet + /ip address) ──────────────

export interface WanInterface {
  /** Nombre en RouterOS: ether1, ether2, lte1, etc. */
  interface: string;
  /** Nombre descriptivo para el operador */
  name: string;
  /** IP pública asignada por el ISP */
  publicIP: string;
  status: "up" | "down";
  latencyMs: number;
  /** Throughput medido en tiempo real */
  throughputRxMbps: number;
  throughputTxMbps: number;
  /** Ancho de banda contratado */
  bandwidthMbps: number;
  provider: string;
  type: LinkType;
  isPrimary: boolean;
  siteId: string;
  uptimePercent: number;
}

// ── Logs de Firewall (RouterOS: /log print where topics~"firewall") ───────────

export type ThreatType = "bruteforce" | "portscan" | "ddos" | "malware" | "geo-block" | "c2-beacon";

export interface FirewallLog {
  id: string;
  timestamp: string;
  /** IP de origen del ataque */
  srcIP: string;
  /** IP destino dentro de la red */
  dstIP: string;
  protocol: "TCP" | "UDP" | "ICMP" | "OTHER";
  dstPort: number;
  action: "drop" | "reject";
  chain: "input" | "forward" | "output";
  threat: ThreatType;
  severity: "critical" | "warning" | "info";
  siteId: string;
  /** País de origen (GeoIP) */
  country?: string;
}

// ── Usuarios VPN activos (RouterOS: /ppp active print) ───────────────────────

export interface VpnUser {
  id: string;
  username: string;
  /** IP pública real del cliente */
  realIP: string;
  /** IP interna asignada por el pool VPN */
  virtualIP: string;
  /** ISO timestamp de inicio de sesión */
  connectedAt: string;
  /** Bytes recibidos por el cliente */
  rxBytes: number;
  /** Bytes enviados por el cliente */
  txBytes: number;
  protocol: "L2TP" | "WireGuard" | "OpenVPN" | "IPsec";
  status: "active" | "idle";
  siteId: string;
}

// ── Provisioning (alta de nuevos sitios y equipos) ────────────────────────────

export type HardwareModel =
  | "MikroTik hEX S"
  | "MikroTik RB4011"
  | "MikroTik CCR2004"
  | "MikroTik RB760iGS"
  | "MikroTik hAP ax³";

/**
 * Plantilla maestra de configuración RouterOS.
 * Cuando se aprovisione un equipo nuevo, se aplica esta plantilla via API.
 * Mapeado a: /system script run [template-name]
 */
export interface ProvisioningTemplate {
  id: string;
  name: string;
  description: string;
  /** Hardware compatible */
  hardware: HardwareModel[];
  /** Tipo de WAN primaria que configura */
  wanType: LinkType;
  /** Funcionalidades que activa */
  features: string[];
  /** Tiempo estimado de deploy en segundos */
  estimatedSeconds: number;
}

/** Estado de un trabajo de aprovisionamiento */
export type JobStatus = "pending" | "running" | "success" | "error";

export interface ProvisioningStep {
  label: string;
  command: string;     // Comando RouterOS
  status: JobStatus;
  log?: string;
}

/** Un trabajo de aprovisionamiento de un sitio */
export interface ProvisioningJob {
  id: string;
  siteId: string;
  siteName: string;
  templateId: string;
  hardware: HardwareModel;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  steps: ProvisioningStep[];
}

/** Formulario para dar de alta un nuevo sitio */
export interface NewSiteFormData {
  name: string;
  shortName: string;
  type: Site["type"];
  coords: GeoCoords;
  templateId: string;
  hardware: HardwareModel;
  provider: string;
  wanType: LinkType;
  bandwidthMbps: number;
  publicIP: string;
}

export interface ISPProvider {
  /** Unique key derived from provider name */
  id: string;
  name: string;
  /** All link types this provider covers across all sites */
  linkTypes: LinkType[];
  /** Sites where this provider has links */
  siteNames: string[];
  /** Weighted health score 0-100 */
  healthScore: number;
  /** Average latency across active links */
  avgLatencyMs: number;
  /** Total contracted bandwidth (sum of all links) */
  totalBandwidthMbps: number;
  /** Current usage Mbps */
  currentUsageMbps: number;
  /** Average SLA uptime */
  avgUptimePercent: number;
  /** Number of failed links */
  failedLinks: number;
  /** Number of active links */
  activeLinks: number;
  claimStatus: ClaimStatus;
}
