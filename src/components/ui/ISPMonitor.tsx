"use client";

import { useState, useEffect, useRef } from "react";
import {
  Wifi,
  Radio,
  Satellite,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  BarChart2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ispHealthTone } from "@/lib/telemetry/isp-utils";
import type { ISPProvider, ClaimStatus, LinkType } from "@/types/telemetry";

interface ISPMonitorProps {
  providers: ISPProvider[];
}

const LINK_TYPE_ICONS: Record<LinkType, React.ElementType> = {
  fiber: Wifi,
  radiolink: Radio,
  starlink: Satellite,
  vpn: Wifi,
};

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  fiber: "Fibra",
  radiolink: "Radio",
  starlink: "Starlink",
  vpn: "VPN",
};

const TONE_COLORS = {
  green: {
    text: "text-vertia-green",
    border: "border-vertia-green/20",
    bg: "bg-vertia-green/5",
    bar: "bg-vertia-green",
    dot: "bg-vertia-green",
  },
  amber: {
    text: "text-vertia-amber",
    border: "border-vertia-amber/20",
    bg: "bg-vertia-amber/5",
    bar: "bg-vertia-amber",
    dot: "bg-vertia-amber",
  },
  red: {
    text: "text-vertia-red",
    border: "border-vertia-red/20",
    bg: "bg-vertia-red/5",
    bar: "bg-vertia-red",
    dot: "bg-vertia-red",
  },
};

// Simulated claim email templates per provider
const CLAIM_TEMPLATES: Record<string, string> = {
  default:
    "Estimado equipo de soporte: Se detectó degradación de servicio en los enlaces bajo contrato. Solicitamos revisión inmediata y reporte de incidente según SLA vigente.",
};

function HealthBar({
  score,
  tone,
  prevScore,
}: {
  score: number;
  tone: "green" | "amber" | "red";
  prevScore: number;
}) {
  const colors = TONE_COLORS[tone];
  const delta = score - prevScore;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500">SALUD DEL SERVICIO</span>
        <div className="flex items-center gap-1.5">
          {delta !== 0 && (
            <span
              className={cn(
                "text-[9px] font-mono",
                delta > 0 ? "text-vertia-green" : "text-vertia-red"
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(0)}
            </span>
          )}
          <span className={cn("text-xs font-mono font-bold", colors.text)}>
            {score}%
          </span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", colors.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function UsageBar({
  usage,
  total,
}: {
  usage: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (usage / total) * 100) : 0;
  const isCongested = pct > 85;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500">USO DE ANCHO DE BANDA</span>
        <span
          className={cn(
            "text-[10px] font-mono",
            isCongested ? "text-vertia-amber" : "text-slate-400"
          )}
        >
          {usage.toFixed(0)}/{total} Mbps
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isCongested ? "bg-vertia-amber" : "bg-vertia-blue"
          )}
          style={{ width: `${pct}%` }}
        />
        {isCongested && (
          <div
            className="absolute inset-y-0 bg-vertia-amber/30 rounded-full animate-pulse"
            style={{ left: "85%", right: 0 }}
          />
        )}
      </div>
    </div>
  );
}

function ClaimButton({
  provider,
  status,
  onClaim,
}: {
  provider: ISPProvider;
  status: ClaimStatus;
  onClaim: () => void;
}) {
  const canClaim = provider.failedLinks > 0 || provider.healthScore < 85;

  if (!canClaim && status === "idle") {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-vertia-green">
        <CheckCircle2 size={11} />
        <span className="font-mono">SLA Cumplido</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClaim}
      disabled={status === "sending" || status === "sent"}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-medium",
        "border transition-all duration-150",
        status === "idle" &&
          "text-vertia-amber border-vertia-amber/30 bg-vertia-amber/5 hover:bg-vertia-amber/10",
        status === "sending" &&
          "text-slate-400 border-white/10 cursor-not-allowed",
        status === "sent" &&
          "text-vertia-green border-vertia-green/20 bg-vertia-green/5 cursor-default",
        status === "error" &&
          "text-vertia-red border-vertia-red/30 bg-vertia-red/5"
      )}
    >
      {status === "idle" && <Send size={11} />}
      {status === "sending" && <Loader2 size={11} className="animate-spin" />}
      {status === "sent" && <CheckCircle2 size={11} />}
      {status === "error" && <XCircle size={11} />}
      <span>
        {status === "idle" && "Reclamo Automático"}
        {status === "sending" && "Enviando..."}
        {status === "sent" && "Reclamo Enviado"}
        {status === "error" && "Error — Reintentar"}
      </span>
    </button>
  );
}

function ISPCard({ provider }: { provider: ISPProvider }) {
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [prevScore, setPrevScore] = useState(provider.healthScore);
  const prevScoreRef = useRef(provider.healthScore);

  useEffect(() => {
    setPrevScore(prevScoreRef.current);
    prevScoreRef.current = provider.healthScore;
  }, [provider.healthScore]);

  const tone = ispHealthTone(provider.healthScore);
  const colors = TONE_COLORS[tone];

  const handleClaim = () => {
    setClaimStatus("sending");
    // Simulate async API call to billing/NOC system
    setTimeout(() => {
      setClaimStatus("sent");
      setTimeout(() => setClaimStatus("idle"), 8000);
    }, 2200);
  };

  return (
    <div
      className={cn(
        "glass-panel rounded-lg p-4 space-y-3 transition-all duration-300",
        "border",
        provider.failedLinks > 0
          ? "border-vertia-red/20"
          : provider.healthScore < 85
            ? "border-vertia-amber/20"
            : "border-vertia-cyan/8"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn("w-2 h-2 rounded-full flex-shrink-0 animate-pulse", colors.dot)}
            />
            <h3 className="text-sm font-semibold text-white truncate">{provider.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {provider.linkTypes.map((type) => {
              const Icon = LINK_TYPE_ICONS[type];
              return (
                <span
                  key={type}
                  className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/8"
                >
                  <Icon size={8} />
                  {LINK_TYPE_LABELS[type]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Score badge */}
        <div
          className={cn(
            "flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded border",
            colors.border,
            colors.bg
          )}
        >
          <span className={cn("text-base font-mono font-bold leading-none", colors.text)}>
            {provider.healthScore}
          </span>
          <span className={cn("text-[8px] font-mono mt-0.5", colors.text)}>SALUD</span>
        </div>
      </div>

      {/* Health bar */}
      <HealthBar
        score={provider.healthScore}
        tone={tone}
        prevScore={prevScore}
      />

      {/* BW bar */}
      <UsageBar usage={provider.currentUsageMbps} total={provider.totalBandwidthMbps} />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <StatMini
          icon={<Clock size={9} />}
          label="Latencia"
          value={
            provider.avgLatencyMs > 0
              ? `${provider.avgLatencyMs.toFixed(0)}ms`
              : "—"
          }
          warn={provider.avgLatencyMs > 40}
        />
        <StatMini
          icon={<BarChart2 size={9} />}
          label="Uptime"
          value={`${provider.avgUptimePercent.toFixed(1)}%`}
          warn={provider.avgUptimePercent < 99}
        />
        <StatMini
          icon={<Wifi size={9} />}
          label="Sitios"
          value={`${provider.siteNames.length}`}
        />
      </div>

      {/* Failed links warning */}
      {provider.failedLinks > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-vertia-red/5 border border-vertia-red/20">
          <AlertTriangle size={11} className="text-vertia-red flex-shrink-0" />
          <span className="text-[10px] text-vertia-red font-mono">
            {provider.failedLinks} enlace{provider.failedLinks > 1 ? "s" : ""} fuera de servicio
          </span>
        </div>
      )}

      {/* Sites list */}
      <div className="text-[10px] font-mono text-slate-600 truncate">
        {provider.siteNames.join(" · ")}
      </div>

      {/* Action */}
      <div className="pt-1 border-t border-white/5 flex items-center justify-between">
        <ClaimButton
          provider={provider}
          status={claimStatus}
          onClaim={handleClaim}
        />
        {claimStatus === "sent" && (
          <span className="text-[9px] font-mono text-slate-600">
            Ticket NOC generado
          </span>
        )}
      </div>
    </div>
  );
}

function StatMini({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-slate-600">{icon}</span>
      <span
        className={cn(
          "font-mono text-[11px] font-medium",
          warn ? "text-vertia-amber" : "text-slate-300"
        )}
      >
        {value}
      </span>
      <span className="text-[9px] font-mono text-slate-600">{label}</span>
    </div>
  );
}

export default function ISPMonitor({ providers }: ISPMonitorProps) {
  const sorted = [...providers].sort((a, b) => a.healthScore - b.healthScore);

  const critical = sorted.filter((p) => p.healthScore < 65);
  const degraded = sorted.filter((p) => p.healthScore >= 65 && p.healthScore < 90);
  const healthy = sorted.filter((p) => p.healthScore >= 90);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={12} className="text-vertia-cyan/60" />
          <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
            Soberanía de Proveedores
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          {critical.length > 0 && (
            <span className="text-vertia-red">{critical.length} crítico{critical.length > 1 ? "s" : ""}</span>
          )}
          {degraded.length > 0 && (
            <span className="text-vertia-amber">{degraded.length} degradado{degraded.length > 1 ? "s" : ""}</span>
          )}
          {healthy.length > 0 && (
            <span className="text-vertia-green">{healthy.length} óptimo{healthy.length > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((provider) => (
          <ISPCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
