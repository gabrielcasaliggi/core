"use client";

import { useState, useRef } from "react";
import { AlertTriangle, Lock, RotateCcw, Zap, Loader2, CheckCircle2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionMode } from "@/types/telemetry";

interface MissionModeButtonsProps {
  currentMode: MissionMode;
  onModeChange?: (mode: MissionMode) => void;
}

interface RouterOSLog {
  ts: string;
  line: string;
  ok: boolean;
}

// Simula la secuencia de comandos que ejecutaría cada modo en RouterOS
const ROUTEROS_SCRIPTS: Record<MissionMode, string[]> = {
  normal: [
    "/ip route set [find comment=backup] disabled=yes",
    "/interface disable [find comment=backup-wan]",
    "/queue simple set [find] max-limit=unlimited",
    "[ OK ] Modo Normal restaurado en RouterOS",
  ],
  contingency: [
    "/ip route set [find comment=primary] disabled=yes",
    "/ip route set [find comment=backup] disabled=no",
    "/interface enable [find comment=backup-wan]",
    "/ip firewall filter set [find chain=forward] action=passthrough",
    "[ OK ] Failover activado — Backup WAN operativo",
  ],
  lockdown: [
    "/queue simple set [find] max-limit=10M/2M",
    "/ip firewall filter add chain=forward protocol=tcp dst-port=!443,80,22 action=drop",
    "/ip hotspot user set [find] limit-bytes-total=0",
    "[ OK ] Modo Cierre — Solo tráfico administrativo permitido",
  ],
};

const MODES = [
  {
    id: "normal" as MissionMode,
    label: "Modo Normal",
    shortLabel: "NORMAL",
    description: "Operación estándar",
    icon: RotateCcw,
    color: "#10B981",
    borderAlpha: "rgba(16,185,129,0.3)",
    bgAlpha: "rgba(16,185,129,0.08)",
  },
  {
    id: "contingency" as MissionMode,
    label: "Modo Contingencia",
    shortLabel: "CONTINGENCIA",
    description: "Conmutación total a backup WAN",
    icon: AlertTriangle,
    color: "#F59E0B",
    borderAlpha: "rgba(245,158,11,0.3)",
    bgAlpha: "rgba(245,158,11,0.08)",
  },
  {
    id: "lockdown" as MissionMode,
    label: "Modo Cierre",
    shortLabel: "CIERRE",
    description: "Priorización tráfico admin",
    icon: Lock,
    color: "#F43F5E",
    borderAlpha: "rgba(244,63,94,0.3)",
    bgAlpha: "rgba(244,63,94,0.08)",
  },
];

export default function MissionModeButtons({
  currentMode,
  onModeChange,
}: MissionModeButtonsProps) {
  const [confirming, setConfirming]   = useState<MissionMode | null>(null);
  const [loading, setLoading]         = useState<MissionMode | null>(null);
  const [logs, setLogs]               = useState<RouterOSLog[]>([]);
  const [showLog, setShowLog]         = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeMode = (mode: MissionMode) => {
    setLoading(mode);
    setLogs([]);
    setShowLog(true);

    const script = ROUTEROS_SCRIPTS[mode];
    // Simula ejecución línea a línea con delay acumulado
    script.forEach((line, i) => {
      setTimeout(() => {
        const isLast = i === script.length - 1;
        const ts = new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        setLogs(prev => [...prev, { ts, line, ok: isLast }]);

        if (isLast) {
          setLoading(null);
          onModeChange?.(mode);
          // Oculta el log después de 4s
          setTimeout(() => setShowLog(false), 4000);
        }
      }, 320 + i * 380);
    });
  };

  const handleClick = (mode: MissionMode) => {
    if (mode === currentMode || loading !== null) return;

    if (mode !== "normal" && confirming !== mode) {
      setConfirming(mode);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(null), 3000);
      return;
    }

    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(null);
    executeMode(mode);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap size={11} style={{ color: "rgba(79,70,229,0.6)" }} />
        <span className="data-value text-[9px] tracking-widest uppercase"
          style={{ color: "rgba(71,85,105,0.65)" }}>
          Modos de Misión
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {MODES.map((mode) => {
          const Icon       = mode.icon;
          const isActive   = currentMode === mode.id;
          const isConfirm  = confirming === mode.id;
          const isLoading  = loading === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => handleClick(mode.id)}
              disabled={loading !== null}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded text-left w-full",
                "border transition-all duration-150",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
              style={{
                border: `1px solid ${isActive || isLoading ? mode.borderAlpha : "rgba(255,255,255,0.07)"}`,
                background: isActive || isLoading ? mode.bgAlpha : "transparent",
                color: isActive ? mode.color : "rgba(148,163,184,0.7)",
              }}
            >
              {/* Barra lateral activa */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                  style={{ background: mode.color }} />
              )}

              {/* Ícono / spinner */}
              {isLoading
                ? <Loader2 size={13} className="flex-shrink-0 animate-spin" style={{ color: mode.color }} />
                : <Icon    size={13} className="flex-shrink-0" />
              }

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="data-value text-[10px] tracking-wide font-semibold">
                    {mode.shortLabel}
                  </span>
                  {isActive && !isLoading && (
                    <span className="data-value text-[8px] px-1.5 py-0.5 rounded tracking-widest"
                      style={{ background: mode.bgAlpha, color: mode.color, border: `1px solid ${mode.borderAlpha}` }}>
                      ACTIVO
                    </span>
                  )}
                  {isConfirm && !isLoading && (
                    <span className="data-value text-[8px] px-1.5 py-0.5 rounded animate-pulse"
                      style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                      CONFIRMAR ↵
                    </span>
                  )}
                  {isLoading && (
                    <span className="data-value text-[8px] tracking-widest"
                      style={{ color: mode.color }}>EJECUTANDO…</span>
                  )}
                </div>
                <p className="data-value text-[9px] mt-0.5 font-normal"
                  style={{ color: "rgba(71,85,105,0.65)" }}>
                  {mode.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Terminal log RouterOS ───────────────────────────────────────────── */}
      {showLog && logs.length > 0 && (
        <div
          className="mt-2 rounded p-2.5 scan-in"
          style={{
            background: "rgba(0,4,12,0.95)",
            border: "1px solid rgba(79,70,229,0.2)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div className="flex items-center gap-1.5 mb-2 border-b pb-1.5"
            style={{ borderColor: "rgba(79,70,229,0.15)" }}>
            <Terminal size={9} style={{ color: "rgba(79,70,229,0.6)" }} />
            <span className="text-[8px] tracking-widest" style={{ color: "rgba(79,70,229,0.6)" }}>
              /api/mikrotik/execute — RouterOS 7.x
            </span>
          </div>
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[7.5px] tabular-nums flex-shrink-0"
                  style={{ color: "rgba(71,85,105,0.5)" }}>{log.ts}</span>
                {log.ok
                  ? <CheckCircle2 size={8} className="flex-shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                  : <span className="text-[8px] flex-shrink-0" style={{ color: "rgba(79,70,229,0.5)" }}>›</span>
                }
                <span className="text-[8px] leading-relaxed"
                  style={{ color: log.ok ? "#10B981" : "rgba(148,163,184,0.7)" }}>
                  {log.line}
                </span>
              </div>
            ))}
            {loading !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <Loader2 size={8} className="animate-spin" style={{ color: "rgba(79,70,229,0.5)" }} />
                <span className="text-[7.5px]" style={{ color: "rgba(79,70,229,0.4)" }}>
                  Esperando confirmación de RouterOS…
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
