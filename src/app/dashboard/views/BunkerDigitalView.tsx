"use client";

/**
 * BunkerDigitalView — Monitor de Amenazas · Firewall
 *
 * Datos mapeados a RouterOS:
 *   logs → /log print where topics~"firewall"
 *   counters → /ip firewall filter print stats
 */

import { useState }   from "react";
import { useNetwork } from "@/context/NetworkContext";
import type { FirewallLog, ThreatType } from "@/types/telemetry";
import { ShieldCheck, ShieldAlert, Filter, Activity } from "lucide-react";

// ── Paleta por severidad y tipo de amenaza ─────────────────────────────────────

const SEVERITY_COLOR = {
  critical: "#F43F5E",
  warning:  "#F59E0B",
  info:     "#4F46E5",
};

const THREAT_LABEL: Record<ThreatType, string> = {
  bruteforce: "BRUTE-FORCE",
  portscan:   "PORT-SCAN",
  ddos:       "DDoS",
  malware:    "MALWARE",
  "geo-block":"GEO-BLOCK",
  "c2-beacon":"C2 BEACON",
};

const SITE_NAMES: Record<string, string> = {
  "site-hq":       "HQ",
  "site-obrador":  "OBR",
  "site-studio":   "EST",
  "site-sucursal": "SUC",
};

type SeverityFilter = "all" | "critical" | "warning" | "info";

// ── Component ──────────────────────────────────────────────────────────────────

export default function BunkerDigitalView() {
  const { firewallLogs } = useNetwork();
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const visible = filter === "all" ? firewallLogs : firewallLogs.filter(l => l.severity === filter);

  const critCount = firewallLogs.filter(l => l.severity === "critical").length;
  const warnCount = firewallLogs.filter(l => l.severity === "warning").length;
  const infoCount = firewallLogs.filter(l => l.severity === "info").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(244,63,94,0.18)", background: "rgba(0,4,14,0.88)" }}>
        <div className="flex items-center gap-3">
          <ShieldAlert size={14} style={{ color: "#F43F5E" }} />
          <span className="data-value text-sm font-semibold tracking-widest" style={{ color: "#fda4af" }}>
            BÚNKER DIGITAL
          </span>
          <span className="data-value text-[9px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>
            · Monitor de Amenazas Bloqueadas
          </span>
        </div>
        <div className="flex items-center gap-6">
          <ThreatStat label="CRÍTICAS"  count={critCount} color="#F43F5E" />
          <ThreatStat label="WARNINGS"  count={warnCount} color="#F59E0B" />
          <ThreatStat label="INFO"      count={infoCount} color="#4F46E5" />
          <ThreatStat label="TOTAL"     count={firewallLogs.length} color="rgba(148,163,184,0.8)" />
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2.5 border-b"
        style={{ borderColor: "rgba(79,70,229,0.1)", background: "rgba(0,4,14,0.6)" }}>
        <Filter size={10} style={{ color: "rgba(71,85,105,0.6)" }} />
        <span className="data-value text-[9px] tracking-widest mr-2" style={{ color: "rgba(71,85,105,0.6)" }}>FILTRAR:</span>
        {(["all", "critical", "warning", "info"] as SeverityFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="data-value text-[9px] px-2.5 py-1 rounded tracking-widest transition-all"
            style={{
              color:      filter === f ? (f === "all" ? "#818cf8" : SEVERITY_COLOR[f as keyof typeof SEVERITY_COLOR]) : "rgba(71,85,105,0.6)",
              background: filter === f ? "rgba(79,70,229,0.08)" : "transparent",
              border:     `1px solid ${filter === f ? "rgba(79,70,229,0.25)" : "rgba(255,255,255,0.05)"}`,
            }}>
            {f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.5)" }}>
          [ {visible.length} eventos ]
        </span>
      </div>

      {/* ── Table header + rows: scroll horizontal en mobile ───────────── */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: 680 }}>

          {/* Table header */}
          <div className="sticky top-0 grid grid-cols-[1.4fr_1.5fr_0.9fr_0.7fr_0.7fr_1fr_0.8fr_0.8fr] gap-3 px-6 py-2 border-b"
            style={{ borderColor: "rgba(79,70,229,0.1)", background: "rgba(4,10,24,0.98)" }}>
            {["TIMESTAMP", "IP ORIGEN", "DESTINO", "PROTO", "PUERTO", "AMENAZA", "SITIO", "ACCIÓN"].map(h => (
              <span key={h} className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{h}</span>
            ))}
          </div>

          {/* Log rows */}
          {visible.map((log, i) => (
            <LogRow key={log.id} log={log} index={i} />
          ))}
          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <ShieldCheck size={24} style={{ color: "#10B981", opacity: 0.4 }} />
              <span className="data-value text-[10px]" style={{ color: "rgba(71,85,105,0.6)" }}>
                No hay eventos con este filtro
              </span>
            </div>
          )}

        </div>
      </div>

      {/* ── Activity bar (live pulse) ────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2 border-t"
        style={{ borderColor: "rgba(244,63,94,0.12)", background: "rgba(0,4,14,0.7)" }}>
        <Activity size={9} className="animate-pulse" style={{ color: "#F43F5E" }} />
        <span className="data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.5)" }}>
          Monitor activo · TODO: GET /api/mikrotik/firewall/logs
        </span>
      </div>
    </div>
  );
}

// ── Log row ────────────────────────────────────────────────────────────────────

function LogRow({ log, index }: { log: FirewallLog; index: number }) {
  const sc    = SEVERITY_COLOR[log.severity];
  const label = THREAT_LABEL[log.threat];

  return (
    <div className="grid grid-cols-[1.4fr_1.5fr_0.9fr_0.7fr_0.7fr_1fr_0.8fr_0.8fr] gap-3 px-6 py-2 border-b items-center"
      style={{
        borderColor: "rgba(79,70,229,0.06)",
        background:  log.severity === "critical"
          ? `rgba(244,63,94,${index % 2 === 0 ? "0.03" : "0.05"})`
          : index % 2 === 0 ? "transparent" : "rgba(79,70,229,0.015)",
        animationDelay: `${index * 30}ms`,
      }}>

      {/* Timestamp */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: sc, boxShadow: log.severity === "critical" ? `0 0 5px ${sc}` : undefined }} />
        <span className="data-value text-[9px] tabular-nums" style={{ color: "rgba(100,116,139,0.7)" }}>
          {new Date(log.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Src IP */}
      <span className="data-value text-[10px] tabular-nums font-medium"
        style={{ color: sc }}>
        {log.srcIP}
        {log.country && <span className="ml-1 text-[8px]" style={{ color: "rgba(71,85,105,0.6)" }}>[{log.country}]</span>}
      </span>

      {/* Dst IP */}
      <span className="data-value text-[9px] tabular-nums" style={{ color: "rgba(100,116,139,0.65)" }}>
        {log.dstIP}
      </span>

      {/* Protocol */}
      <span className="data-value text-[9px]" style={{ color: "rgba(100,116,139,0.7)" }}>{log.protocol}</span>

      {/* Port */}
      <span className="data-value text-[10px] tabular-nums font-medium"
        style={{ color: "rgba(148,163,184,0.8)" }}>
        :{log.dstPort || "—"}
      </span>

      {/* Threat */}
      <span className="data-value text-[8.5px] px-1.5 py-0.5 rounded tracking-wider font-semibold"
        style={{ color: sc, background: `${sc}12`, border: `1px solid ${sc}22` }}>
        {label}
      </span>

      {/* Site */}
      <span className="data-value text-[9px]" style={{ color: "rgba(79,70,229,0.7)" }}>
        {SITE_NAMES[log.siteId] ?? log.siteId}
      </span>

      {/* Action */}
      <span className="data-value text-[9px] uppercase"
        style={{ color: log.action === "drop" ? "#F43F5E" : "#F59E0B" }}>
        {log.action}
      </span>
    </div>
  );
}

function ThreatStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div className="data-value text-[18px] font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 10px ${color}50` }}>{count}</div>
      <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{label}</div>
    </div>
  );
}
