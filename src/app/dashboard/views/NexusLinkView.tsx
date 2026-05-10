"use client";

/**
 * NexusLinkView — Topología VPN · Nexus-Link
 *
 * Datos mapeados a RouterOS:
 *   túneles → /ip ipsec active-peers print
 *              /interface l2tp-server server print
 *              /interface wireguard peers print
 */

import { useNetwork } from "@/context/NetworkContext";
import { Network, Lock, ArrowRight } from "lucide-react";

const SITE_NAMES: Record<string, string> = {
  "site-hq":       "Casa Central",
  "site-obrador":  "Obrador",
  "site-studio":   "Estudio Jurídico",
  "site-sucursal": "Sucursal",
};

const PROTOCOL_COLOR: Record<string, string> = {
  WireGuard: "#10B981",
  IPsec:     "#4F46E5",
  L2TP:      "#06B6D4",
  OpenVPN:   "#F59E0B",
};

export default function NexusLinkView() {
  const { snapshot } = useNetwork();

  // Flatten todos los túneles con info del sitio padre
  const allTunnels = snapshot.sites.flatMap(site =>
    site.vpnTunnels.map(t => ({ ...t, siteName: SITE_NAMES[site.id] ?? site.id, siteId: site.id }))
  );

  const upCount   = allTunnels.filter(t => t.status === "active").length;
  const downCount = allTunnels.filter(t => t.status !== "active").length;
  const enc256    = allTunnels.filter(t => t.encryptionBits === 256).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(79,70,229,0.15)", background: "rgba(0,4,14,0.88)" }}>
        <div className="flex items-center gap-3">
          <Network size={14} style={{ color: "#4F46E5" }} />
          <span className="data-value text-sm font-semibold tracking-widest" style={{ color: "#818cf8" }}>
            NEXUS-LINK VPN
          </span>
          <span className="data-value text-[9px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>
            · Topología de Túneles · Encriptación Militar
          </span>
        </div>
        <div className="flex items-center gap-6">
          <VpnStat label="TÚNELES"  value={allTunnels.length} color="#4F46E5" />
          <VpnStat label="ACTIVOS"  value={upCount}   color="#10B981" />
          <VpnStat label="CAÍDOS"   value={downCount} color="#F43F5E" />
          <VpnStat label="AES-256"  value={enc256}    color="#06B6D4" />
        </div>
      </div>

      {/* Table header + rows con scroll horizontal en mobile */}
      <div className="flex-1 overflow-auto">
      <div style={{ minWidth: 620 }}>

      {/* Table header */}
      <div className="sticky top-0 grid grid-cols-[1.5fr_1.5fr_1.2fr_1fr_1fr_0.8fr_0.9fr] gap-3 px-6 py-2 border-b"
        style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(4,10,24,0.98)" }}>
        {["ORIGEN", "DESTINO", "PROTOCOLO", "ESTADO", "LATENCIA", "CIFRADO", "ID"].map(h => (
          <span key={h} className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {allTunnels.map((t, i) => {
          const isUp     = t.status === "active";
          const sc       = isUp ? "#10B981" : "#F43F5E";
          const pcColor  = PROTOCOL_COLOR[t.protocol] ?? "#94a3b8";

          return (
            <div key={t.id}
              className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1fr_1fr_0.8fr_0.9fr] gap-3 px-6 py-3 border-b items-center"
              style={{ borderColor: "rgba(79,70,229,0.07)", background: i % 2 === 0 ? "transparent" : "rgba(79,70,229,0.015)" }}>

              {/* Origin site */}
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc, boxShadow: isUp ? `0 0 5px ${sc}` : undefined }} />
                <span className="data-value text-[10px] font-medium" style={{ color: "rgba(226,232,240,0.85)" }}>
                  {t.siteName}
                </span>
              </div>

              {/* Destination */}
              <div className="flex items-center gap-1.5">
                <ArrowRight size={9} style={{ color: "rgba(79,70,229,0.5)" }} />
                <span className="data-value text-[10px]" style={{ color: "rgba(148,163,184,0.75)" }}>
                  {SITE_NAMES[t.targetSiteId] ?? t.targetSiteId}
                </span>
              </div>

              {/* Protocol */}
              <span className="data-value text-[9.5px] font-semibold px-2 py-0.5 rounded"
                style={{ color: pcColor, background: `${pcColor}12`, border: `1px solid ${pcColor}25` }}>
                {t.protocol}
              </span>

              {/* Status */}
              <span className="data-value text-[9px] font-semibold uppercase"
                style={{ color: sc }}>{t.status}</span>

              {/* Latency */}
              <span className="data-value text-[10px] tabular-nums font-medium"
                style={{ color: isUp ? (t.latencyMs > 30 ? "#F59E0B" : "#10B981") : "rgba(71,85,105,0.5)" }}>
                {isUp ? `[ ${t.latencyMs}ms ]` : "—"}
              </span>

              {/* Encryption */}
              <div className="flex items-center gap-1">
                <Lock size={9} style={{ color: t.encryptionBits === 256 ? "#4F46E5" : "#06B6D4" }} />
                <span className="data-value text-[9px]"
                  style={{ color: t.encryptionBits === 256 ? "#818cf8" : "#67e8f9" }}>
                  AES-{t.encryptionBits}
                </span>
              </div>

              {/* ID */}
              <span className="data-value text-[8.5px] tabular-nums" style={{ color: "rgba(71,85,105,0.55)" }}>
                {t.id}
              </span>
            </div>
          );
        })}

        {allTunnels.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Network size={24} style={{ color: "#4F46E5", opacity: 0.3 }} />
            <span className="data-value text-[10px]" style={{ color: "rgba(71,85,105,0.6)" }}>No hay túneles VPN configurados</span>
          </div>
        )}
      </div>{/* rows */}
      </div>{/* min-width */}
      </div>{/* overflow-auto */}

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-2 border-t"
        style={{ borderColor: "rgba(79,70,229,0.12)", background: "rgba(0,4,14,0.7)" }}>
        <span className="data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.5)" }}>
          TODO: /ip ipsec active-peers print · /interface wireguard peers print
        </span>
      </div>
    </div>
  );
}

function VpnStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="data-value text-[18px] font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 10px ${color}50` }}>{value}</div>
      <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{label}</div>
    </div>
  );
}
