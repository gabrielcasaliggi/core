"use client";

import { useState, useEffect } from "react";
import { Bell, Wifi, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/telemetry";

interface TopBarProps {
  alerts: Alert[];
  globalScore: number;
}

export default function TopBar({ alerts, globalScore }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const hasCritical = unacknowledged.some((a) => a.severity === "critical");
  const hasWarning = unacknowledged.some((a) => a.severity === "warning");

  const scoreColor =
    globalScore >= 90
      ? "text-vertia-green"
      : globalScore >= 70
        ? "text-vertia-amber"
        : "text-vertia-red";

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-navy-900/80 backdrop-blur-sm border-b border-vertia-cyan/10">
      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-white font-semibold text-sm tracking-widest uppercase">
            CORE-Map · Orquestador de Conectividad
          </h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            Vertia Advisory — Infraestructuras Soberanas
          </p>
        </div>
      </div>

      {/* Center: Status indicators */}
      <div className="flex items-center gap-6">
        <StatusPill icon={<Wifi size={12} />} label="SD-WAN" status="operational" value="3 sitios" />
        <StatusPill icon={<Shield size={12} />} label="Firewall" status="operational" value="Activo" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-mono">RESILIENCE</span>
          <span className={cn("font-mono font-bold text-sm", scoreColor)}>{globalScore}%</span>
        </div>
      </div>

      {/* Right: Clock + Alerts */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock size={12} />
          <span className="font-mono text-xs tabular-nums">
            {currentTime.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        <button
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
            hasCritical
              ? "text-vertia-red border border-vertia-red/30 bg-vertia-red/5 hover:bg-vertia-red/10"
              : hasWarning
                ? "text-vertia-amber border border-vertia-amber/30 bg-vertia-amber/5 hover:bg-vertia-amber/10"
                : "text-slate-400 border border-white/10 hover:bg-white/5"
          )}
        >
          <Bell size={12} />
          <span>{unacknowledged.length} alertas</span>
          {(hasCritical || hasWarning) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-vertia-amber animate-ping" />
          )}
        </button>
      </div>
    </header>
  );
}

function StatusPill({
  icon,
  label,
  status,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  status: "operational" | "degraded" | "offline";
  value: string;
}) {
  const dotColor =
    status === "operational"
      ? "bg-vertia-green"
      : status === "degraded"
        ? "bg-vertia-amber"
        : "bg-vertia-red";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColor)} />
      <span className="text-slate-500 font-mono">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}
