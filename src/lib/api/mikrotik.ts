/**
 * Cliente tipado para la RouterOS REST API v7.
 *
 * Todas las funciones llaman a /api/mikrotik/* (proxy Next.js server-side)
 * para no exponer credenciales en el navegador y evitar CORS.
 *
 * Referencia RouterOS REST: https://help.mikrotik.com/docs/display/ROS/REST+API
 */

// ── Tipos de respuesta RouterOS ───────────────────────────────────────────────

export interface RosIdentity {
  name: string;
}

export interface RosResource {
  uptime: string;
  version: string;
  "build-time": string;
  /** 0–100 */
  "cpu-load": string;
  "free-memory": string;
  "total-memory": string;
  "cpu-count": string;
  "cpu-frequency": string;
  "board-name": string;
  "architecture-name": string;
  platform: string;
}

export interface RosInterface {
  ".id": string;
  name: string;
  /** "ether" | "wireguard" | "bridge" | "vlan" | "pppoe-out" | "lte" | "wlan" ... */
  type: string;
  running: boolean;
  disabled: boolean;
  "rx-byte": string;
  "tx-byte": string;
  "rx-packet": string;
  "tx-packet": string;
  mtu: string;
  "actual-mtu"?: string;
  comment?: string;
}

export interface RosIPAddress {
  ".id": string;
  address: string;    // "192.168.1.1/24"
  interface: string;
  network: string;
  disabled: boolean;
  invalid?: boolean;
}

export interface RosPPPActive {
  ".id": string;
  name: string;
  /** IP pública real del cliente */
  "caller-id": string;
  /** IP virtual del pool */
  address: string;
  uptime: string;
  /** Bytes recibidos por el servidor (enviados por el cliente) */
  "bytes-in": string;
  /** Bytes enviados por el servidor (recibidos por el cliente) */
  "bytes-out": string;
  service: string;
  encoding?: string;
}

export interface RosDHCPLease {
  ".id": string;
  "active-address"?: string;
  "mac-address": string;
  "host-name"?: string;
  status: string;
  disabled: boolean;
}

export interface RosFirewallRule {
  ".id": string;
  chain: string;
  action: string;
  disabled: boolean;
  comment?: string;
}

export interface RosLog {
  ".id": string;
  time: string;
  topics: string;
  message: string;
}

export interface RosWireGuardPeer {
  ".id": string;
  interface: string;
  "public-key": string;
  "endpoint-address"?: string;
  "endpoint-port"?: string;
  "allowed-address": string;
  comment?: string;
  disabled: boolean;
}

export interface RosHealthItem {
  name: string;
  /** Valor numérico como string */
  value: string;
  /** "C" | "V" | "%" | "A" | "RPM" */
  type: string;
}

export interface RosRoute {
  ".id": string;
  "dst-address": string;
  gateway: string;
  distance: string;
  active: boolean | string;
  disabled: boolean | string;
  /** Interfaz de salida */
  "gateway-status"?: string;
  interface?: string;
  comment?: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

/**
 * Llama a la ruta proxy correcta según el routerId:
 *   - routerId = "office"  → /api/mikrotik/[...path]   (proxy legacy, OFC)
 *   - routerId = cualquier otro → /api/routers/[routerId]/[...path]
 */
async function rosGet<T>(
  path: string,
  routerId = "office",
  params?: Record<string, string>,
): Promise<T> {
  const base =
    routerId === "office"
      ? `/api/mikrotik/${path}`
      : `/api/routers/${routerId}/${path}`;

  const url = new URL(base, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status} en /${path}`,
    );
  }

  return res.json() as Promise<T>;
}

// ── Factory: cliente para un router específico ────────────────────────────────

/**
 * Crea un cliente tipado para el router indicado.
 *
 * Uso:
 *   const ros = createMikrotikClient("hq");
 *   const id  = await ros.identity();
 *
 * El routerId debe coincidir con el prefijo ROUTER_<ID>_* en .env.local,
 * excepto "office" que sigue usando el proxy legacy /api/mikrotik/*.
 */
export interface RosSnapshot {
  identity:     RosIdentity;
  resource:     RosResource;
  interfaces:   RosInterface[];
  ip_addresses: RosIPAddress[];
  ip_routes:    RosRoute[];
}

export function createMikrotikClient(routerId = "office") {
  const g = <T>(path: string, params?: Record<string, string>) =>
    rosGet<T>(path, routerId, params);

  return {
    /** Snapshot agregado: identity+resource+interfaces+ip_addresses+ip_routes
     *  en una sola llamada server-side para evitar el límite de conexiones RouterOS. */
    snapshot:      () => g<RosSnapshot>("snapshot"),
    identity:      () => g<RosIdentity>("system/identity"),
    resource:      () => g<RosResource>("system/resource"),
    interfaces:    () => g<RosInterface[]>("interface"),
    ipAddresses:   () => g<RosIPAddress[]>("ip/address"),
    pppActive:     () => g<RosPPPActive[]>("ppp/active"),
    dhcpLeases:    () => g<RosDHCPLease[]>("ip/dhcp-server/lease"),
    firewallRules: () => g<RosFirewallRule[]>("ip/firewall/filter"),
    logs:          (topic?: string) =>
      g<RosLog[]>("log", topic ? { ".proplist": "time,topics,message", topics: topic } : undefined),
    wireguardPeers: () => g<RosWireGuardPeer[]>("interface/wireguard/peers"),
    health:        () => g<RosHealthItem[]>("system/health"),
    routes:        () => g<RosRoute[]>("ip/route"),
  };
}

/** Cliente por defecto apuntando al router de oficina (backward compat). */
export const mikrotik = createMikrotikClient("office");
