"use client";

/**
 * NetworkContext — Fuente única de verdad de todos los datos de red.
 *
 * Arquitectura:
 *   useTelemetry (mock fluctuante) ─────────────────────┐
 *   RouterPoller[] (Supabase → MikroTik por cada router) ┤──► snapshot fusionado ──► componentes
 *                                                        ┘
 *
 * Al arrancar, carga la lista de routers desde Supabase (/api/routers).
 * Por cada router activo instancia un RouterPoller que hace polling en
 * background y empuja los datos al estado del Provider.
 * Agregar un router via Provisioning View → aparece en el mapa automáticamente.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  NetworkSnapshot,
  WanInterface,
  FirewallLog,
  VpnUser,
  MissionMode,
  ViewId,
} from "@/types/telemetry";
import { useTelemetry }          from "@/lib/telemetry/use-telemetry";
import {
  useRealSite,
  type RealSiteData,
  type RouterSiteConfig,
}                                from "@/lib/telemetry/use-real-site";
import { extractISPProviders }   from "@/lib/telemetry/isp-utils";
import {
  MOCK_WAN_INTERFACES,
  MOCK_FIREWALL_LOGS,
  MOCK_VPN_USERS,
}                                from "@/lib/telemetry/mock-data";
import type { ISPProvider }      from "@/types/telemetry";
import type { RouterRow }        from "@/lib/supabase/types";

// ── Context shape ──────────────────────────────────────────────────────────────

interface NetworkContextValue {
  snapshot:      NetworkSnapshot;
  isps:          ISPProvider[];
  wanInterfaces: WanInterface[];
  firewallLogs:  FirewallLog[];
  vpnUsers:      VpnUser[];

  activeView:    ViewId;
  setActiveView: (view: ViewId) => void;

  missionMode:    MissionMode;
  setMissionMode: (mode: MissionMode) => void;

  /** Datos vivos de un router real específico (por siteId) */
  getRealSite: (siteId: string) => RealSiteData | undefined;

  /** Indica si los routers ya fueron cargados desde Supabase */
  routersLoaded: boolean;

  forceFailover: (interfaceId: string, siteId: string) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToConfig(row: RouterRow): RouterSiteConfig {
  return {
    // routerId = site_id completo (ej: "site-office")
    // El proxy buscará credenciales en Supabase cuando no hay env vars
    routerId:  row.site_id,
    siteId:    row.site_id,
    shortName: row.short_name,
    type:      row.site_type,
    coords:    { lat: Number(row.lat), lng: Number(row.lng) },
  };
}

// ── RouterPoller ───────────────────────────────────────────────────────────────
//
// Componente interno que instancia UN useRealSite y empuja los datos
// al estado del Provider vía callback. Este patrón permite crear
// dinámicamente N pollers sin violar las reglas de hooks de React.

interface RouterPollerProps {
  config:     RouterSiteConfig;
  paused:     boolean;
  intervalMs: number;
  onUpdate:   (siteId: string, data: RealSiteData) => void;
}

function RouterPoller({ config, paused, intervalMs, onUpdate }: RouterPollerProps) {
  const data  = useRealSite({ config, paused, intervalMs });
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (data) cbRef.current(config.siteId, data);
  }, [data, config.siteId]);

  return null;
}

// ── Context & hook ─────────────────────────────────────────────────────────────

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [activeView,    setActiveView]    = useState<ViewId>("resiliencia");
  const [missionMode,   setMissionMode]   = useState<MissionMode>("normal");
  const [wanInterfaces, setWanInterfaces] = useState<WanInterface[]>(MOCK_WAN_INTERFACES);

  // Routers cargados desde Supabase
  const [routerConfigs,  setRouterConfigs]  = useState<RouterSiteConfig[]>([]);
  const [routersLoaded,  setRoutersLoaded]  = useState(false);
  // Mapa siteId → RealSiteData para todos los routers activos
  const [realSiteMap, setRealSiteMap] = useState<Record<string, RealSiteData>>({});

  const paused = missionMode === "lockdown";

  // ── Cargar lista de routers desde Supabase ──────────────────────────────────
  useEffect(() => {
    async function loadRouters() {
      try {
        const res = await fetch("/api/routers");
        if (!res.ok) return;
        const rows: RouterRow[] = await res.json();
        setRouterConfigs(rows.filter(r => r.enabled).map(rowToConfig));
      } catch {
        /* sin Supabase: mapa solo mock */
      } finally {
        setRoutersLoaded(true);
      }
    }
    loadRouters();
    // Re-verificar cada 30s por si se agregó un router vía Provisioning
    const interval = setInterval(loadRouters, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Callback para RouterPoller ──────────────────────────────────────────────
  const handleSiteUpdate = useCallback((siteId: string, data: RealSiteData) => {
    setRealSiteMap(prev => ({ ...prev, [siteId]: data }));
  }, []);

  // ── Snapshot fusionado: mock + todos los routers reales ────────────────────
  const mockSnapshot = useTelemetry({ intervalMs: 5000, paused });

  const snapshot = useMemo<NetworkSnapshot>(() => {
    let sites = [...mockSnapshot.sites];

    for (const realData of Object.values(realSiteMap)) {
      const idx = sites.findIndex(s => s.id === realData.site.id);
      if (idx >= 0) sites[idx] = realData.site;
      else sites = [...sites, realData.site];
    }

    return { ...mockSnapshot, sites };
  }, [mockSnapshot, realSiteMap]);

  // ── WAN interfaces fusionadas ───────────────────────────────────────────────
  const mergedWanInterfaces = useMemo<WanInterface[]>(() => {
    const realSiteIds = new Set(Object.keys(realSiteMap));
    const mockOnly    = wanInterfaces.filter(w => !realSiteIds.has(w.siteId));
    const realWans    = Object.values(realSiteMap).flatMap(d => d.wanInterfaces);
    return [...mockOnly, ...realWans];
  }, [wanInterfaces, realSiteMap]);

  // ── VPN users fusionados ────────────────────────────────────────────────────
  const mergedVpnUsers = useMemo<VpnUser[]>(() => {
    const realSiteIds = new Set(Object.keys(realSiteMap));
    const mockOnly    = MOCK_VPN_USERS.filter(u => !realSiteIds.has(u.siteId));
    const realUsers   = Object.values(realSiteMap).flatMap(d => d.vpnUsers);
    return [...mockOnly, ...realUsers];
  }, [realSiteMap]);

  // ── Firewall logs: reales de los routers + mock del resto ──────────────────
  const mergedFirewallLogs = useMemo<FirewallLog[]>(() => {
    const realSiteIds = new Set(Object.keys(realSiteMap));
    const realLogs    = Object.values(realSiteMap).flatMap(d => d.firewallLogs);
    // Si hay logs reales, usar solo esos; si no, usar mock
    if (realLogs.length > 0) return realLogs;
    return MOCK_FIREWALL_LOGS.filter(l => !realSiteIds.has(l.siteId));
  }, [realSiteMap]);

  const isps = extractISPProviders(snapshot);

  const forceFailover = useCallback(async (interfaceId: string, siteId: string) => {
    await new Promise(r => setTimeout(r, 1400));
    setWanInterfaces(prev =>
      prev.map(iface =>
        iface.interface === interfaceId && iface.siteId === siteId
          ? { ...iface, isPrimary: !iface.isPrimary }
          : iface,
      ),
    );
  }, []);

  const getRealSite = useCallback(
    (siteId: string) => realSiteMap[siteId],
    [realSiteMap],
  );

  const value: NetworkContextValue = {
    snapshot,
    isps,
    wanInterfaces: mergedWanInterfaces,
    firewallLogs:  mergedFirewallLogs,
    vpnUsers:      mergedVpnUsers,
    activeView,
    setActiveView,
    missionMode,
    setMissionMode,
    getRealSite,
    routersLoaded,
    forceFailover,
  };

  return (
    <NetworkContext.Provider value={value}>
      {/* Un RouterPoller por cada router activo en Supabase */}
      {routerConfigs.map(cfg => (
        <RouterPoller
          key={cfg.siteId}
          config={cfg}
          paused={paused}
          intervalMs={5000}
          onUpdate={handleSiteUpdate}
        />
      ))}
      {children}
    </NetworkContext.Provider>
  );
}
