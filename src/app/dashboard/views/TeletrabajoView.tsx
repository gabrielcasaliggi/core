"use client";

/**
 * TeletrabajoView — Usuarios VPN Activos · Teletrabajo Seguro
 *
 * Datos mapeados a RouterOS:
 *   usuarios activos → /ppp active print
 *   stats sesión     → /ppp active print detail
 *
 * rxBytes / txBytes se expresan en formato human-readable.
 */

import { useNetwork } from "@/context/NetworkContext";
import { Users, Wifi, ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";

const SITE_NAMES: Record<string, string> = {
  "site-hq":       "Casa Central",
  "site-obrador":  "Obrador",
  "site-studio":   "Estudio Jurídico",
  "site-sucursal": "Sucursal",
};

const PROTO_COLOR: Record<string, string> = {
  WireGuard: "#10B981",
  IPsec:     "#4F46E5",
  L2TP:      "#06B6D4",
  OpenVPN:   "#F59E0B",
};

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function fmtDuration(isoStart: string): string {
  const sec = Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000);
  const h   = Math.floor(sec / 3600);
  const m   = Math.floor((sec % 3600) / 60);
  const s   = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function TeletrabajoView() {
  const { vpnUsers } = useNetwork();

  const active   = vpnUsers.filter(u => u.status === "active").length;
  const idle     = vpnUsers.filter(u => u.status === "idle").length;
  const totalRx  = vpnUsers.reduce((a, u) => a + u.rxBytes, 0);
  const totalTx  = vpnUsers.reduce((a, u) => a + u.txBytes, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(79,70,229,0.15)", background: "rgba(0,4,14,0.88)" }}>
        <div className="flex items-center gap-3">
          <Users size={14} style={{ color: "#4F46E5" }} />
          <span className="data-value text-sm font-semibold tracking-widest" style={{ color: "#818cf8" }}>
            TELETRABAJO SEGURO
          </span>
          <span className="data-value text-[9px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>
            · Usuarios VPN Activos · Consumo en Tiempo Real
          </span>
        </div>
        <div className="flex items-center gap-6">
          <UserStat label="CONECTADOS" value={vpnUsers.length} color="#818cf8" />
          <UserStat label="ACTIVOS"    value={active} color="#10B981" />
          <UserStat label="IDLE"       value={idle}   color="#F59E0B" />
          <div className="text-center">
            <div className="data-value text-[11px] font-bold tabular-nums leading-tight"
              style={{ color: "#06B6D4" }}>
              {fmtBytes(totalRx + totalTx)}
            </div>
            <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>SESIÓN TOTAL</div>
          </div>
        </div>
      </div>

      {/* Table header + rows con scroll horizontal en mobile */}
      <div className="flex-1 overflow-auto">
      <div style={{ minWidth: 700 }}>

      {/* Table header */}
      <div className="sticky top-0 grid grid-cols-[1.8fr_1.3fr_1.2fr_1fr_1.2fr_1.2fr_1fr_0.8fr] gap-3 px-6 py-2 border-b"
        style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(4,10,24,0.98)" }}>
        {["USUARIO", "IP REAL", "IP VPN", "PROTOCOLO", "SESIÓN", "RX", "TX", "ESTADO"].map(h => (
          <span key={h} className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {vpnUsers.map((user, i) => {
          const isActive = user.status === "active";
          const sc       = isActive ? "#10B981" : "#F59E0B";
          const pc       = PROTO_COLOR[user.protocol] ?? "#94a3b8";

          return (
            <div key={user.id}
              className="grid grid-cols-[1.8fr_1.3fr_1.2fr_1fr_1.2fr_1.2fr_1fr_0.8fr] gap-3 px-6 py-3 border-b items-center"
              style={{ borderColor: "rgba(79,70,229,0.07)", background: i % 2 === 0 ? "transparent" : "rgba(79,70,229,0.015)" }}>

              {/* Username */}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: sc, boxShadow: isActive ? `0 0 5px ${sc}` : undefined }} />
                <div>
                  <div className="data-value text-[10px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>
                    {user.username}
                  </div>
                  <div className="data-value text-[8.5px]" style={{ color: "rgba(79,70,229,0.6)" }}>
                    {SITE_NAMES[user.siteId] ?? user.siteId}
                  </div>
                </div>
              </div>

              {/* Real IP */}
              <span className="data-value text-[9.5px] tabular-nums" style={{ color: "rgba(148,163,184,0.7)" }}>
                {user.realIP}
              </span>

              {/* Virtual IP */}
              <span className="data-value text-[9.5px] tabular-nums font-medium" style={{ color: "#818cf8" }}>
                [ {user.virtualIP} ]
              </span>

              {/* Protocol */}
              <span className="data-value text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: pc, background: `${pc}12`, border: `1px solid ${pc}25` }}>
                {user.protocol}
              </span>

              {/* Session duration */}
              <div className="flex items-center gap-1.5">
                <Clock size={9} style={{ color: "rgba(71,85,105,0.5)" }} />
                <span className="data-value text-[10px] tabular-nums font-medium"
                  style={{ color: "rgba(148,163,184,0.8)" }}>
                  [ {fmtDuration(user.connectedAt)} ]
                </span>
              </div>

              {/* RX */}
              <div className="flex items-center gap-1">
                <ArrowDownToLine size={9} style={{ color: "#10B981" }} />
                <span className="data-value text-[9.5px] tabular-nums font-medium" style={{ color: "#10B981" }}>
                  {fmtBytes(user.rxBytes)}
                </span>
              </div>

              {/* TX */}
              <div className="flex items-center gap-1">
                <ArrowUpFromLine size={9} style={{ color: "rgba(100,116,139,0.7)" }} />
                <span className="data-value text-[9.5px] tabular-nums" style={{ color: "rgba(100,116,139,0.7)" }}>
                  {fmtBytes(user.txBytes)}
                </span>
              </div>

              {/* Status */}
              <span className="data-value text-[9px] font-semibold uppercase"
                style={{ color: sc }}>{user.status}</span>
            </div>
          );
        })}

        {vpnUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Wifi size={24} style={{ color: "#4F46E5", opacity: 0.3 }} />
            <span className="data-value text-[10px]" style={{ color: "rgba(71,85,105,0.6)" }}>No hay usuarios VPN activos</span>
          </div>
        )}
      </div>{/* rows */}
      </div>{/* min-width */}
      </div>{/* overflow-auto */}

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-2 border-t"
        style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(0,4,14,0.7)" }}>
        <span className="data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.5)" }}>
          TODO: /ppp active print · actualización cada 5s
        </span>
      </div>
    </div>
  );
}

function UserStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="data-value text-[18px] font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 10px ${color}50` }}>{value}</div>
      <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{label}</div>
    </div>
  );
}
