"use client";

import { Wifi, WifiOff, Radio, Satellite, Shield, Users, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSiteStatusColor, getLinkTypeLabel } from "@/lib/telemetry/mock-data";
import type { Site } from "@/types/telemetry";
import ResilienceScore from "./ResilienceScore";

interface SiteCardProps {
  site: Site;
  className?: string;
}

const LINK_ICONS = {
  fiber: Wifi,
  radiolink: Radio,
  starlink: Satellite,
  vpn: Shield,
};

const STATUS_LABELS: Record<string, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  critical: "Crítico",
  offline: "Desconectado",
};

export default function SiteCard({ site, className }: SiteCardProps) {
  const statusColor = getSiteStatusColor(site.status);
  const activeLinks = site.links.filter((l) => l.status === "active");
  const primaryLink = activeLinks[0];

  return (
    <div
      className={cn(
        "glass-panel rounded-lg p-4 flex gap-4 transition-all duration-200",
        "hover:border-vertia-cyan/25",
        className
      )}
    >
      {/* Score */}
      <div className="flex-shrink-0">
        <ResilienceScore score={site.resilienceScore} size="sm" showLabel={false} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div>
            <h3 className="text-white font-semibold text-sm">{site.name}</h3>
            <span
              className="text-[10px] font-mono"
              style={{ color: statusColor }}
            >
              {STATUS_LABELS[site.status]}
            </span>
          </div>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded border"
            style={{
              color: statusColor,
              borderColor: `${statusColor}30`,
              backgroundColor: `${statusColor}10`,
            }}
          >
            {site.shortName}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2">
          <StatItem icon={<Cpu size={10} />} value={site.connectedDevices} label="disp." />
          <StatItem icon={<Users size={10} />} value={site.activeUsers} label="users" />
          {primaryLink && (
            <StatItem
              icon={<Wifi size={10} />}
              value={`${primaryLink.latencyMs}ms`}
              label="latencia"
            />
          )}
        </div>

        {/* Links */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {site.links.map((link) => {
            const Icon = LINK_ICONS[link.type] ?? Wifi;
            const color =
              link.status === "active"
                ? "#10b981"
                : link.status === "standby"
                  ? "#f59e0b"
                  : "#ef4444";
            return (
              <span
                key={link.id}
                className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color,
                  backgroundColor: `${color}10`,
                  border: `1px solid ${color}25`,
                }}
              >
                <Icon size={8} />
                {link.type.toUpperCase()}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-slate-500">{icon}</span>
      <span className="font-mono font-medium text-slate-300">{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}
