"use client";

/**
 * useRealSite — polling hook que consulta el MikroTik de oficina cada N ms
 * y mapea la respuesta RouterOS a los tipos del dashboard.
 *
 * Convivencia con useTelemetry:
 *   - useTelemetry fluctúa los 4 sitios mock.
 *   - useRealSite gestiona UNO solo: "site-office".
 *   - NetworkContext los fusiona en un único NetworkSnapshot.
 *
 * Ajustar OFFICE_COORDS a la ubicación real de la oficina.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { Site, WanInterface, VpnUser, VPNTunnel, SiteStatus, GeoCoords, FirewallLog, ThreatType } from "@/types/telemetry";
import { createMikrotikClient } from "@/lib/api/mikrotik";
import type { RosInterface, RosIPAddress, RosPPPActive, RosWireGuardPeer, RosHealthItem, RosRoute, RosLog } from "@/lib/api/mikrotik";

// ── Configuración del sitio OFC (router de oficina) ───────────────────────────

export const OFFICE_SITE_ID = "site-office";

/**
 * Coordenadas de la oficina en el mapa.
 * Ajustar a la ubicación real del router.
 * Por defecto: Rosario, Santa Fe (separado visualmente del resto de los sitios)
 */
const OFFICE_COORDS: GeoCoords = { lat: -32.89, lng: -60.64 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte uptime RouterOS "1w2d3h4m5s" a segundos */
function parseUptimeSeconds(uptime: string): number {
  let s = 0;
  const w = uptime.match(/(\d+)w/)?.[1]; if (w) s += +w * 7 * 86400;
  const d = uptime.match(/(\d+)d/)?.[1]; if (d) s += +d * 86400;
  const h = uptime.match(/(\d+)h/)?.[1]; if (h) s += +h * 3600;
  const m = uptime.match(/(\d+)m/)?.[1]; if (m) s += +m * 60;
  const sc = uptime.match(/(\d+)s/)?.[1]; if (sc) s += +sc;
  return s;
}

/**
 * RouterOS REST API puede devolver booleanos como strings "true"/"false"
 * dependiendo de la versión. Esta función normaliza ambos casos.
 */
function rosBoolean(val: boolean | string | undefined): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string")  return val === "true";
  return false;
}

/** Interfaces físicas WAN: ether, lte, wlan, pppoe-out. Excluye bridges, VLANs, etc. */
function isPhysicalWan(iface: RosInterface): boolean {
  const t = iface.type;
  return (
    t === "ether"    ||
    t === "lte"      ||
    t === "wlan"     ||
    t.startsWith("pppoe") ||
    t.startsWith("pptp")
  );
}

/** Determina el tipo de enlace según el nombre/tipo de interfaz RouterOS */
function linkTypeFromIface(iface: RosInterface): WanInterface["type"] {
  if (iface.name.startsWith("lte") || iface.type === "lte") return "radiolink";
  if (iface.name.startsWith("wlan") || iface.type === "wlan") return "radiolink";
  if (iface.name.startsWith("starlink") || iface.comment?.toLowerCase().includes("starlink")) return "starlink";
  return "fiber";
}

/** Extrae temperatura/voltaje del array de health items */
function healthValue(items: RosHealthItem[], name: string): number | null {
  const item = items.find(i => i.name === name);
  if (!item) return null;
  const v = parseFloat(item.value);
  return isNaN(v) ? null : v;
}

/** Convierte un RosLog de firewall a FirewallLog del dashboard */
function rosLogToFirewall(log: RosLog, idx: number, siteId: string): FirewallLog | null {
  const msg = log.message ?? "";
  // Solo procesar entradas de firewall con acción drop/reject
  if (!msg.includes("in:") && !msg.includes("forward") && !msg.includes("input")) return null;

  // Extraer src IP: "src-mac ... src-ip X.X.X.X" o "from X.X.X.X"
  const srcMatch = msg.match(/src-address[=:\s]+([\d.]+)/) ?? msg.match(/from ([\d.]+)/);
  const dstMatch = msg.match(/dst-address[=:\s]+([\d.]+)/) ?? msg.match(/to ([\d.]+)/);
  const portMatch = msg.match(/(?:dst-port|dport)[=:\s]+(\d+)/);
  const protoMatch = msg.match(/proto[=:\s]+(\w+)/) ?? msg.match(/(tcp|udp|icmp)/i);

  if (!srcMatch) return null;

  const srcIP  = srcMatch[1];
  const dstIP  = dstMatch?.[1] ?? "—";
  const dstPort = portMatch ? parseInt(portMatch[1]) : 0;
  const proto   = (protoMatch?.[1] ?? "OTHER").toUpperCase() as FirewallLog["protocol"];

  // Detectar tipo de amenaza por puerto/patrón
  const threat: ThreatType =
    dstPort === 22 || dstPort === 3389 ? "bruteforce" :
    msg.toLowerCase().includes("scan") ? "portscan" :
    dstPort === 80 || dstPort === 443 ? "c2-beacon" : "geo-block";

  const severity: FirewallLog["severity"] =
    threat === "bruteforce" ? "critical" :
    threat === "portscan"   ? "warning"  : "info";

  // Parsear timestamp RouterOS "mmm/dd/yyyy hh:mm:ss" o "hh:mm:ss"
  let timestamp: string;
  try {
    const t = log.time ?? "";
    const months: Record<string, string> = {
      jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
      jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
    };
    const full = t.match(/(\w{3})\/(\d+)\/(\d{4})\s+(\d+:\d+:\d+)/);
    if (full) {
      const [, mon, day, year, time] = full;
      timestamp = `${year}-${months[mon.toLowerCase()] ?? "01"}-${day.padStart(2,"0")}T${time}`;
    } else {
      timestamp = new Date().toISOString();
    }
  } catch {
    timestamp = new Date().toISOString();
  }

  return {
    id:       `fw-${siteId}-${idx}`,
    timestamp,
    srcIP,
    dstIP,
    protocol: ["TCP","UDP","ICMP"].includes(proto) ? proto as "TCP"|"UDP"|"ICMP" : "OTHER",
    dstPort,
    action:   "drop",
    chain:    msg.includes("forward") ? "forward" : "input",
    threat,
    severity,
    siteId,
  };
}

/** Proveedor a partir del comentario; fallback genérico */
function providerFromIface(iface: RosInterface): string {
  if (iface.comment) {
    const m = iface.comment.match(/(?:ISP|proveedor|provider)[:\s]+(.+)/i);
    if (m) return m[1].trim();
    return iface.comment.trim();
  }
  if (iface.name.startsWith("lte")) return "LTE";
  if (iface.name.startsWith("wlan")) return "WiFi";
  return "ISP";
}

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type RealSiteStatus = "connecting" | "online" | "error";

export interface RealSiteData {
  site: Site;
  wanInterfaces: WanInterface[];
  vpnUsers: VpnUser[];
  firewallLogs: FirewallLog[];
  /** Porcentaje CPU 0-100 */
  cpuLoad: number;
  /** Porcentaje RAM usada 0-100 */
  ramUsedPct: number;
  /** Versión RouterOS */
  rosVersion: string;
  /** Board name */
  boardName: string;
  /** Temperatura CPU en °C (null si el hardware no lo reporta) */
  cpuTempC: number | null;
  /** Temperatura del board en °C */
  boardTempC: number | null;
  /** Voltaje de entrada en V */
  voltageV: number | null;
  /** Interfaz WAN activa como ruta default (failover awareness) */
  activeWanGateway: string | null;
  status: RealSiteStatus;
  /** Mensaje de error si status === "error" */
  error?: string;
  lastPolledAt: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface RouterSiteConfig {
  /** ID del router en .env.local (ej: "office", "hq", "sucursal") */
  routerId: string;
  /** ID del sitio en el snapshot del dashboard */
  siteId: string;
  /** Shortname de 3 letras para el mapa */
  shortName: string;
  /** Tipo de sitio */
  type: Site["type"];
  /** Coordenadas en el mapa */
  coords: GeoCoords;
}

/** Config por defecto: router de oficina */
const OFFICE_CONFIG: RouterSiteConfig = {
  routerId: "office",
  siteId:   OFFICE_SITE_ID,
  shortName: "OFC",
  type:      "branch",
  coords:    OFFICE_COORDS,
};

interface UseRealSiteOptions {
  intervalMs?: number;
  /** Detener el polling (e.g. Modo Cierre) */
  paused?: boolean;
  /** Configuración del router. Por defecto: oficina. */
  config?: RouterSiteConfig;
}

export function useRealSite({
  intervalMs = 5000,
  paused = false,
  config = OFFICE_CONFIG,
}: UseRealSiteOptions = {}): RealSiteData | null {
  const [data, setData] = useState<RealSiteData | null>(null);
  const ros = useRef(createMikrotikClient(config.routerId));

  // Guardamos rx/tx previo para calcular throughput incremental
  const prevCounters = useRef<Map<string, { rx: number; tx: number; ts: number }>>(new Map());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const poll = useCallback(async () => {
    const client = ros.current;
    try {
      // Llamadas paralelas para minimizar latencia total
      const [identity, resource, ifaces, addresses, pppActive, dhcpLeases, wgPeers, healthItems, routeTable, fwLogs] =
        await Promise.all([
          client.identity(),
          client.resource(),
          client.interfaces(),
          client.ipAddresses().catch(() => [] as RosIPAddress[]),
          client.pppActive().catch(() => [] as RosPPPActive[]),
          client.dhcpLeases().catch(() => []),
          client.wireguardPeers().catch(() => [] as RosWireGuardPeer[]),
          client.health().catch(() => [] as RosHealthItem[]),
          client.routes().catch(() => [] as RosRoute[]),
          client.logs("firewall").catch(() => [] as RosLog[]),
        ]);

      const now = Date.now();

      // ── Mapa IP por interfaz (/ip/address) ───────────────────────────────
      const ipMap = new Map<string, string>();
      for (const addr of addresses as RosIPAddress[]) {
        if (!rosBoolean(addr.disabled) && !rosBoolean(addr.invalid)) {
          ipMap.set(addr.interface, addr.address.split("/")[0]);
        }
      }

      // ── IPs públicas (no RFC1918) → detectadas desde /ip/address ──────────
      const publicIpMap = new Map<string, string>();
      for (const [iface, ip] of ipMap) {
        if (!ip.startsWith("192.168.") && !ip.startsWith("10.") && !ip.startsWith("172.")) {
          publicIpMap.set(iface, ip);
        }
      }

      // ── Fallback: tabla de rutas → default route indica la interfaz WAN ──
      // Útil cuando /ip/address no devuelve IPs dinámicas (PPPoE, LTE, DHCP)
      console.log(`[useRealSite:${config.siteId}] routeTable raw=`, JSON.stringify(routeTable).slice(0, 400));
      if (publicIpMap.size === 0) {
        const defaultRoutes = (routeTable as RosRoute[]).filter(
          r => r["dst-address"] === "0.0.0.0/0" && rosBoolean(r.active) && !rosBoolean(r.disabled),
        );
        console.log(`[useRealSite:${config.siteId}] defaultRoutes=`, JSON.stringify(defaultRoutes).slice(0, 400));
        defaultRoutes.sort((a, b) => parseInt(a.distance ?? "1") - parseInt(b.distance ?? "1"));
        for (const route of defaultRoutes) {
          const gw    = route.gateway ?? "";
          const iface = route.interface ?? gw;
          // gateway que empieza con letra → nombre de interfaz (ej: "pppoe-out1")
          const ifaceName = /^[a-zA-Z]/.test(gw) && !gw.includes(".") ? gw : iface;
          if (ifaceName) {
            publicIpMap.set(ifaceName, ipMap.get(ifaceName) ?? "—");
          }
        }
        console.log(`[useRealSite:${config.siteId}] publicIpMap after fallback=`, Object.fromEntries(publicIpMap));
      }

      // ── WAN interfaces: cualquier interfaz en publicIpMap, no disabled ────
      const wanIfaces = (ifaces as RosInterface[]).filter(iface =>
        !rosBoolean(iface.disabled) && publicIpMap.has(iface.name),
      );
      console.log(`[useRealSite:${config.siteId}] wanIfaces final=`, wanIfaces.map(i => i.name));

      const wanInterfaces: WanInterface[] = wanIfaces.map((iface) => {
        const rxBytes = parseInt(iface["rx-byte"] ?? "0", 10);
        const txBytes = parseInt(iface["tx-byte"] ?? "0", 10);
        const prev = prevCounters.current.get(iface.name);

        let throughputRx = 0;
        let throughputTx = 0;

        if (prev && now > prev.ts) {
          const dtS = (now - prev.ts) / 1000;
          throughputRx = Math.max(0, ((rxBytes - prev.rx) * 8) / dtS / 1_000_000);
          throughputTx = Math.max(0, ((txBytes - prev.tx) * 8) / dtS / 1_000_000);
        }

        prevCounters.current.set(iface.name, { rx: rxBytes, tx: txBytes, ts: now });

        const ip = publicIpMap.get(iface.name) ?? ipMap.get(iface.name) ?? "—";
        const isUp = rosBoolean(iface.running) && !rosBoolean(iface.disabled);

        return {
          interface: iface.name,
          name: iface.comment ?? iface.name,
          publicIP: ip,
          status: isUp ? "up" : "down",
          latencyMs: 0,
          throughputRxMbps: parseFloat(throughputRx.toFixed(2)),
          throughputTxMbps: parseFloat(throughputTx.toFixed(2)),
          bandwidthMbps: 100,        // RouterOS no expone ancho contratado
          provider: providerFromIface(iface),
          type: linkTypeFromIface(iface),
          isPrimary: iface.name === "ether1" || iface.type.startsWith("pppoe") || !!iface.comment?.toLowerCase().includes("wan1"),
          siteId: config.siteId,
          uptimePercent: 99.0,       // Solo con histórico real se puede calcular
        } satisfies WanInterface;
      });

      // ── VPN users (PPP active) ─────────────────────────────────────────────
      const vpnUsers: VpnUser[] = (pppActive as RosPPPActive[]).map((u, i) => {
        const svc = (u.service ?? "").toLowerCase();
        const protocol: VpnUser["protocol"] =
          svc.includes("wireguard") ? "WireGuard" :
          svc.includes("ipsec")     ? "IPsec"     :
          svc.includes("ovpn")      ? "OpenVPN"   : "L2TP";
        return {
          id: `vpn-office-${i}`,
          username: u.name,
          realIP: u["caller-id"],
          virtualIP: u.address,
          connectedAt: new Date(now - parseUptimeSeconds(u.uptime) * 1000).toISOString(),
          rxBytes: parseInt(u["bytes-in"] ?? "0", 10),
          txBytes: parseInt(u["bytes-out"] ?? "0", 10),
          protocol,
          status: "active",
          siteId: config.siteId,
        };
      });

      // ── DHCP leases → connectedDevices ────────────────────────────────────
      const activeLeases = (dhcpLeases as { status?: string; disabled?: boolean | string }[])
        .filter(l => l.status === "bound" && !rosBoolean(l.disabled as boolean | string));

      // ── WireGuard peers → vpnTunnels ──────────────────────────────────────
      const vpnTunnels: VPNTunnel[] = (wgPeers as RosWireGuardPeer[])
        .filter(p => !rosBoolean(p.disabled))
        .map((p, i) => ({
          id: `wg-office-${i}`,
          targetSiteId: p.comment || p["public-key"].slice(0, 8),
          protocol: "WireGuard" as const,
          status: "active" as const,    // RouterOS no expone estado de peer via REST
          encryptionBits: 256 as const,
          latencyMs: 0,
        }));

      // ── Site status y resilience ───────────────────────────────────────────
      // Si el router respondió (llegamos aquí), está al menos operativo.
      // El estado se degrada solo si hay interfaces WAN detectadas y caídas.
      const runningWan = wanIfaces.filter(i => rosBoolean(i.running) && !rosBoolean(i.disabled));
      const siteStatus: SiteStatus =
        wanIfaces.length === 0
          ? "operational"                              // sin WAN detectada, pero router responde
          : runningWan.length === 0
            ? "degraded"                               // WAN detectada pero todas caídas
            : runningWan.length < wanIfaces.length
              ? "degraded"
              : "operational";

      const cpuLoad = parseInt(resource["cpu-load"] ?? "0", 10);
      const memFree  = parseInt(resource["free-memory"]  ?? "0", 10);
      const memTotal = parseInt(resource["total-memory"] ?? "1",  10);
      const ramUsedPct = Math.round(((memTotal - memFree) / memTotal) * 100);

      // ── Hardware health ────────────────────────────────────────────────────
      const hi = healthItems as RosHealthItem[];
      const cpuTempC   = healthValue(hi, "cpu-temperature") ?? healthValue(hi, "temperature");
      const boardTempC = healthValue(hi, "board-temperature") ?? healthValue(hi, "temperature2");
      const voltageV   = healthValue(hi, "voltage") ?? healthValue(hi, "psu1-voltage");

      // ── Ruta default activa → detectar failover ────────────────────────────
      const defaultRoutes = (routeTable as RosRoute[]).filter(
        r => r["dst-address"] === "0.0.0.0/0" && rosBoolean(r.active) && !rosBoolean(r.disabled),
      );
      // La ruta con menor distance es la activa
      defaultRoutes.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
      const activeWanGateway = defaultRoutes[0]?.gateway ?? null;

      // ── Firewall logs reales ───────────────────────────────────────────────
      const firewallLogs = (fwLogs as RosLog[])
        .map((log, i) => rosLogToFirewall(log, i, config.siteId))
        .filter((l): l is FirewallLog => l !== null)
        .slice(0, 50);   // máximo 50 entradas recientes

      let resilienceScore = 100;
      if (siteStatus === "degraded") resilienceScore -= 25;
      if (cpuLoad > 80)    resilienceScore -= 15;
      if (ramUsedPct > 85) resilienceScore -= 10;
      resilienceScore = Math.max(0, Math.min(100, Math.round(resilienceScore)));

      // ── Links (mapeo de WAN interfaces al tipo Link) ───────────────────────
      const links = wanInterfaces.map((wan) => ({
        id: `link-office-${wan.interface}`,
        type: wan.type,
        provider: wan.provider,
        status: (wan.status === "up" ? "active" : "failed") as "active" | "failed",
        latencyMs: 0,
        bandwidthMbps: wan.bandwidthMbps,
        usageMbps: parseFloat((wan.throughputRxMbps + wan.throughputTxMbps).toFixed(2)),
        uptimePercent: wan.uptimePercent,
      }));

      const site: Site = {
        id: config.siteId,
        name: identity.name || config.shortName,
        shortName: config.shortName,
        type: config.type,
        coords: config.coords,
        status: siteStatus,
        resilienceScore,
        links: links.length > 0 ? links : [],
        vpnTunnels,
        connectedDevices: activeLeases.length || vpnUsers.length,
        activeUsers: vpnUsers.filter(u => u.status === "active").length,
        firewallEnabled: true,
        lastUpdated: new Date().toISOString(),
      };

      setData({
        site,
        wanInterfaces,
        vpnUsers,
        firewallLogs,
        cpuLoad,
        ramUsedPct,
        rosVersion:       resource.version ?? "—",
        boardName:        resource["board-name"] ?? "MikroTik",
        cpuTempC,
        boardTempC,
        voltageV,
        activeWanGateway,
        status:           "online",
        lastPolledAt:     new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sin respuesta del router";
      console.warn("[useRealSite]", message);

      setData((prev) => {
        const offlineSite: Site = {
          id: config.siteId,
          name: config.shortName,
          shortName: config.shortName,
          type: config.type,
          coords: config.coords,
          status: "offline",
          resilienceScore: 0,
          links: [],
          vpnTunnels: [],
          connectedDevices: 0,
          activeUsers: 0,
          firewallEnabled: false,
          lastUpdated: new Date().toISOString(),
        };

        return {
          site:             prev?.site ?? offlineSite,
          wanInterfaces:    prev?.wanInterfaces ?? [],
          vpnUsers:         prev?.vpnUsers ?? [],
          firewallLogs:     prev?.firewallLogs ?? [],
          cpuLoad:          0,
          ramUsedPct:       0,
          rosVersion:       prev?.rosVersion ?? "—",
          boardName:        prev?.boardName ?? "MikroTik",
          cpuTempC:         prev?.cpuTempC ?? null,
          boardTempC:       prev?.boardTempC ?? null,
          voltageV:         prev?.voltageV ?? null,
          activeWanGateway: prev?.activeWanGateway ?? null,
          status:           "error",
          error:            message,
          lastPolledAt:     new Date().toISOString(),
        };
      });
    }
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    poll(); // llamada inmediata al montar

    timerRef.current = setInterval(poll, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, intervalMs, paused]);

  return data;
}
