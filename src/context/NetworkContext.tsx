"use client";

/**
 * NetworkContext — Fuente única de verdad de todos los datos de red.
 *
 * Arquitectura:
 *   RouterOS API  ──►  aquí  ──►  todos los componentes
 *
 * Cuando se conecte la API real, solo hay que reemplazar los imports de
 * mock-data y el hook useTelemetry por llamadas a /api/mikrotik/*.
 * El resto del árbol de componentes no cambia.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
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
import { extractISPProviders }   from "@/lib/telemetry/isp-utils";
import {
  MOCK_WAN_INTERFACES,
  MOCK_FIREWALL_LOGS,
  MOCK_VPN_USERS,
}                                from "@/lib/telemetry/mock-data";
import type { ISPProvider }      from "@/types/telemetry";

// ── Context shape ──────────────────────────────────────────────────────────────

interface NetworkContextValue {
  // ── Datos de red en tiempo real ──────────────────────────────────────────
  snapshot:      NetworkSnapshot;
  isps:          ISPProvider[];
  wanInterfaces: WanInterface[];
  firewallLogs:  FirewallLog[];
  vpnUsers:      VpnUser[];

  // ── Navegación ────────────────────────────────────────────────────────────
  activeView:    ViewId;
  setActiveView: (view: ViewId) => void;

  // ── Modo de misión ────────────────────────────────────────────────────────
  missionMode:    MissionMode;
  setMissionMode: (mode: MissionMode) => void;

  // ── Acciones hacia RouterOS (stub — implementar en /api/mikrotik/execute) ─
  /** Fuerza failover en la interfaz WAN indicada */
  forceFailover: (interfaceId: string, siteId: string) => Promise<void>;
}

// ── Context & hook ─────────────────────────────────────────────────────────────

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [activeView,   setActiveView]   = useState<ViewId>("resiliencia");
  const [missionMode,  setMissionMode]  = useState<MissionMode>("normal");
  const [wanInterfaces, setWanInterfaces] = useState<WanInterface[]>(MOCK_WAN_INTERFACES);

  // Telemetría live (se pausa en Modo Cierre para priorizar tráfico admin)
  const snapshot = useTelemetry({
    intervalMs: 5000,
    paused: missionMode === "lockdown",
  });

  const isps = extractISPProviders(snapshot);

  /**
   * Fuerza failover en una interfaz WAN.
   * Stub: simula latencia de red → actualiza estado local.
   * TODO: POST /api/mikrotik/execute { command: '/ip route ...' }
   */
  const forceFailover = useCallback(async (interfaceId: string, siteId: string) => {
    await new Promise(r => setTimeout(r, 1400));
    setWanInterfaces(prev =>
      prev.map(iface => {
        if (iface.interface !== interfaceId || iface.siteId !== siteId) return iface;
        // Swaps primary flag — en RouterOS: /ip route set priority
        return { ...iface, isPrimary: !iface.isPrimary };
      })
    );
  }, []);

  const value: NetworkContextValue = {
    snapshot,
    isps,
    wanInterfaces,
    firewallLogs:  MOCK_FIREWALL_LOGS,
    vpnUsers:      MOCK_VPN_USERS,
    activeView,
    setActiveView,
    missionMode,
    setMissionMode,
    forceFailover,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}
