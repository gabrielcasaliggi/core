"use client";

import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/telemetry";

interface AlertFeedProps {
  alerts: Alert[];
}

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    color: "text-vertia-red",
    bg: "bg-vertia-red/5",
    border: "border-vertia-red/20",
    dot: "bg-vertia-red",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-vertia-amber",
    bg: "bg-vertia-amber/5",
    border: "border-vertia-amber/20",
    dot: "bg-vertia-amber",
  },
  info: {
    icon: Info,
    color: "text-vertia-blue",
    bg: "bg-vertia-blue/5",
    border: "border-vertia-blue/20",
    dot: "bg-vertia-blue",
  },
};

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  return `hace ${Math.floor(mins / 60)}h`;
}

export default function AlertFeed({ alerts }: AlertFeedProps) {
  const sorted = [...alerts].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
          Feed de Alertas
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {alerts.filter((a) => !a.acknowledged).length} activas
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
          <CheckCircle size={12} className="text-vertia-green" />
          <span>Sin alertas activas</span>
        </div>
      ) : (
        sorted.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-2.5 p-2.5 rounded text-xs border",
                cfg.bg,
                cfg.border
              )}
            >
              <Icon size={12} className={cn("flex-shrink-0 mt-0.5", cfg.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 leading-snug">{alert.message}</p>
                <p className="text-slate-600 font-mono text-[10px] mt-1">
                  {formatRelative(alert.timestamp)}
                </p>
              </div>
              {!alert.acknowledged && (
                <span
                  className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1", cfg.dot)}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
