"use client";

/**
 * SDWanView — Interfaces WAN · Control SD-WAN
 *
 * Datos mapeados a RouterOS:
 *   interface  → /interface ethernet print
 *   publicIP   → /ip address print
 *   latency    → /tool ping [gw] count=1
 *   throughput → /interface monitor-traffic [iface] once
 */

import { useState }    from "react";
import { useNetwork }  from "@/context/NetworkContext";
import type { WanInterface } from "@/types/telemetry";
import {
  ArrowDownToLine, ArrowUpFromLine, Wifi, WifiOff,
  CheckCircle2, Loader2, Zap, RefreshCw,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SITE_NAMES: Record<string, string> = {
  "site-hq":       "Casa Central",
  "site-obrador":  "Obrador",
  "site-studio":   "Estudio Jurídico",
  "site-sucursal": "Sucursal",
};

function bwBar(used: number, total: number) {
  const pct = Math.min(100, (used / total) * 100);
  const color = pct > 85 ? "#F59E0B" : pct > 60 ? "#06B6D4" : "#10B981";
  return { pct, color };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SDWanView() {
  const { wanInterfaces, forceFailover, snapshot } = useNetwork();
  const [loadingIface, setLoadingIface]  = useState<string | null>(null);
  const [successIface, setSuccessIface]  = useState<string | null>(null);

  const upCount   = wanInterfaces.filter(i => i.status === "up").length;
  const downCount = wanInterfaces.filter(i => i.status === "down").length;
  const primaries = wanInterfaces.filter(i => i.isPrimary).length;

  // Nombre de sitio: primero el snapshot real (Supabase), luego el hardcoded
  function siteName(siteId: string): string {
    return snapshot.sites.find(s => s.id === siteId)?.name
      ?? SITE_NAMES[siteId]
      ?? siteId;
  }

  const handleFailover = async (iface: WanInterface) => {
    const key = `${iface.siteId}:${iface.interface}`;
    setLoadingIface(key);
    setSuccessIface(null);
    await forceFailover(iface.interface, iface.siteId);
    setLoadingIface(null);
    setSuccessIface(key);
    setTimeout(() => setSuccessIface(null), 3000);
  };

  // Agrupa por sitio
  const bySite = wanInterfaces.reduce<Record<string, WanInterface[]>>((acc, iface) => {
    (acc[iface.siteId] ??= []).push(iface);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(79,70,229,0.15)", background: "rgba(0,6,18,0.8)" }}>
        <div className="flex items-center gap-2 md:gap-3">
          <Wifi size={14} style={{ color: "#4F46E5" }} />
          <span className="data-value text-sm font-semibold tracking-widest" style={{ color: "#818cf8" }}>
            ENLACE SD-WAN
          </span>
          <span className="data-value text-[9px] tracking-widest hidden md:inline" style={{ color: "rgba(71,85,105,0.6)" }}>
            · Interfaces WAN · Control de Failover
          </span>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <Stat label="INTERFACES" value={wanInterfaces.length} color="#4F46E5" />
          <Stat label="ACTIVAS"    value={upCount}   color="#10B981" />
          <Stat label="CAÍDAS"     value={downCount} color="#F43F5E" />
          <Stat label="PRIMARIAS"  value={primaries} color="#06B6D4" />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6">
        {Object.entries(bySite).map(([siteId, ifaces]) => (
          <section key={siteId}>

            {/* Site header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="data-value text-[9px] tracking-widest uppercase"
                style={{ color: "rgba(71,85,105,0.6)" }}>SITIO</span>
              <span className="data-value text-[11px] font-semibold tracking-wider"
                style={{ color: "#818cf8" }}>{siteName(siteId)}</span>
              <div className="flex-1 h-px" style={{ background: "rgba(79,70,229,0.15)" }} />
            </div>

            {/* Interface table */}
            <div className="rounded-lg overflow-x-auto"
              style={{ border: "1px solid rgba(79,70,229,0.18)", background: "rgba(0,6,20,0.6)" }}>
              <div style={{ minWidth: 640 }}>

                {/* Table head */}
                <div className="grid grid-cols-[2fr_1.4fr_0.8fr_1.1fr_1.5fr_1fr_1fr] gap-3 px-4 py-2 border-b"
                  style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(79,70,229,0.05)" }}>
                  {["INTERFAZ / NOMBRE", "IP PÚBLICA", "LATENCIA", "BW CONTRATADO", "USO RX / TX", "ROL", "ACCIÓN"].map(h => (
                    <span key={h} className="data-value text-[8.5px] tracking-widest" style={{ color: "rgba(71,85,105,0.65)" }}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {ifaces.map(iface => {
                  const key = `${iface.siteId}:${iface.interface}`;
                  const isLoading = loadingIface === key;
                  const isSuccess = successIface === key;
                  const { pct: rxPct, color: rxColor } = bwBar(iface.throughputRxMbps, iface.bandwidthMbps);
                  const isDown = iface.status === "down";

                  return (
                    <div key={key}
                      className="grid grid-cols-[2fr_1.4fr_0.8fr_1.1fr_1.5fr_1fr_1fr] gap-3 px-4 py-3 border-b items-center"
                      style={{ borderColor: "rgba(79,70,229,0.07)", background: isDown ? "rgba(244,63,94,0.03)" : "transparent" }}>

                      {/* Interface + name */}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {isDown
                            ? <WifiOff size={11} style={{ color: "#F43F5E" }} />
                            : <CheckCircle2 size={11} style={{ color: "#10B981" }} />}
                          <span className="data-value text-[11px] font-semibold"
                            style={{ color: isDown ? "#F43F5E" : "rgba(226,232,240,0.9)" }}>
                            {iface.interface}
                          </span>
                        </div>
                        <span className="data-value text-[9px]" style={{ color: "rgba(100,116,139,0.7)" }}>
                          {iface.name}
                        </span>
                      </div>

                      {/* Public IP */}
                      <span className="data-value text-[10px] tabular-nums"
                        style={{ color: isDown ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.85)" }}>
                        [ {isDown ? "—" : iface.publicIP} ]
                      </span>

                      {/* Latency */}
                      <span className="data-value text-[11px] font-semibold tabular-nums"
                        style={{ color: isDown ? "#F43F5E" : iface.latencyMs > 50 ? "#F59E0B" : "#10B981" }}>
                        {isDown ? "DOWN" : `[ ${iface.latencyMs}ms ]`}
                      </span>

                      {/* BW contratado */}
                      <span className="data-value text-[10px]" style={{ color: "rgba(148,163,184,0.7)" }}>
                        {iface.bandwidthMbps} Mbps
                      </span>

                      {/* RX / TX with bar */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ArrowDownToLine size={9} style={{ color: rxColor }} />
                          <span className="data-value text-[9.5px] tabular-nums" style={{ color: rxColor }}>
                            {iface.throughputRxMbps.toFixed(1)} Mbps
                          </span>
                          <ArrowUpFromLine size={9} style={{ color: "rgba(100,116,139,0.6)" }} />
                          <span className="data-value text-[9.5px] tabular-nums" style={{ color: "rgba(100,116,139,0.7)" }}>
                            {iface.throughputTxMbps.toFixed(1)}
                          </span>
                        </div>
                        {!isDown && (
                          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${rxPct}%`, background: rxColor }} />
                          </div>
                        )}
                      </div>

                      {/* Rol */}
                      <span className="data-value text-[9px] px-1.5 py-0.5 rounded text-center"
                        style={{
                          color:      iface.isPrimary ? "#06B6D4" : "rgba(100,116,139,0.7)",
                          background: iface.isPrimary ? "rgba(6,182,212,0.08)" : "transparent",
                          border:     `1px solid ${iface.isPrimary ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.06)"}`,
                        }}>
                        {iface.isPrimary ? "PRIMARIO" : "BACKUP"}
                      </span>

                      {/* Failover button */}
                      <button
                        onClick={() => handleFailover(iface)}
                        disabled={isLoading || isDown}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded data-value text-[9px] font-semibold transition-all"
                        style={{
                          color:      isSuccess ? "#10B981" : isDown ? "rgba(71,85,105,0.4)" : "#F59E0B",
                          border:     `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : isDown ? "rgba(71,85,105,0.15)" : "rgba(245,158,11,0.3)"}`,
                          background: isSuccess ? "rgba(16,185,129,0.08)" : isDown ? "transparent" : "rgba(245,158,11,0.06)",
                          cursor:     isLoading || isDown ? "not-allowed" : "pointer",
                        }}>
                        {isLoading ? <Loader2 size={10} className="animate-spin" />
                          : isSuccess ? <CheckCircle2 size={10} />
                          : <Zap size={10} />}
                        {isLoading ? "…" : isSuccess ? "OK" : "FAILOVER"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-2 border-t flex items-center gap-2"
        style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(0,4,14,0.7)" }}>
        <RefreshCw size={9} style={{ color: "rgba(79,70,229,0.4)" }} />
        <span className="data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.5)" }}>
          WAN data · RouterOS REST API
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="data-value text-[18px] font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 10px ${color}50` }}>{value}</div>
      <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{label}</div>
    </div>
  );
}
