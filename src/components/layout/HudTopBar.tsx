"use client";

import { useState, useEffect } from "react";
import { Bell, Wifi, Shield, Clock, Radio, Menu } from "lucide-react";
import type { Alert } from "@/types/telemetry";

interface HudTopBarProps {
  alerts: Alert[];
  globalScore: number;
  missionMode?: import("@/types/telemetry").MissionMode;
  onMobileMenuToggle?: () => void;
}

export default function HudTopBar({ alerts, globalScore, missionMode, onMobileMenuToggle }: HudTopBarProps) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const unack      = alerts.filter(a => !a.acknowledged);
  const hasCrit    = unack.some(a => a.severity === "critical");
  const hasWarn    = unack.some(a => a.severity === "warning");
  const alertColor = hasCrit ? "#F43F5E" : hasWarn ? "#F59E0B" : "rgba(71,85,105,0.7)";
  const scoreColor = globalScore >= 90 ? "#10B981" : globalScore >= 70 ? "#F59E0B" : "#F43F5E";

  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-3 md:px-5 py-2.5 border-b gap-2"
      style={{
        background:     "rgba(0,4,14,0.9)",
        backdropFilter: "blur(16px)",
        borderColor:    "rgba(79,70,229,0.15)",
        minHeight:      44,
      }}
    >
      {/* Mobile hamburger */}
      <button
        className="flex-shrink-0 p-1.5 rounded md:hidden"
        style={{ border: "1px solid rgba(79,70,229,0.25)", color: "rgba(129,140,248,0.7)" }}
        onClick={onMobileMenuToggle}
        aria-label="Menú"
      >
        <Menu size={15} />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ border: "1px solid rgba(79,70,229,0.35)", background: "rgba(79,70,229,0.08)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#4F46E5", boxShadow: "0 0 7px #4F46E5" }} />
          <span className="data-value text-xs font-bold tracking-widest"
            style={{ color: "#818cf8", textShadow: "0 0 10px rgba(79,70,229,0.7)" }}>
            VERTIA
          </span>
          <span className="data-value text-xs tracking-widest hidden sm:inline"
            style={{ color: "rgba(79,70,229,0.5)" }}>
            CORE
          </span>
        </div>
        {/* Subtitle: solo en pantallas grandes */}
        <span className="data-value text-[9px] tracking-widest hidden lg:inline"
          style={{ color: "rgba(71,85,105,0.55)" }}>
          ORQUESTADOR DE CONECTIVIDAD SOBERANA
        </span>
      </div>

      {/* Mission mode badge */}
      {missionMode && missionMode !== "normal" && (
        <span className="data-value text-[9px] font-bold px-2 py-1 rounded tracking-widest flex-shrink-0"
          style={{
            color:      missionMode === "contingency" ? "#F59E0B" : "#F43F5E",
            border:     `1px solid ${missionMode === "contingency" ? "rgba(245,158,11,0.35)" : "rgba(244,63,94,0.35)"}`,
            background: missionMode === "contingency" ? "rgba(245,158,11,0.08)" : "rgba(244,63,94,0.08)",
            animation:  "blink 1.2s step-end infinite",
          }}>
          <span className="hidden sm:inline">⚠ MODO </span>
          {missionMode === "contingency" ? "CONTINGENCIA" : "CIERRE"}
        </span>
      )}

      {/* Center: live status pills — ocultos en mobile */}
      <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
        <StatusPill icon={<Wifi size={10} />}   label="SD-WAN" value={unack.length > 0 ? "ALERTA" : "OK"} ok={unack.length === 0} />
        <StatusPill icon={<Shield size={10} />} label="FW"     value="ACTIVO" ok />
        <StatusPill icon={<Radio size={10} />}  label="VPN"    value="UP"     ok />
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded data-value text-[10px]"
          style={{ border: `1px solid ${scoreColor}35`, background: `${scoreColor}09` }}
        >
          <span style={{ color: "rgba(71,85,105,0.7)" }}>RESILIENCE</span>
          <span className="font-bold tabular-nums"
            style={{ color: scoreColor, textShadow: `0 0 10px ${scoreColor}80` }}>
            [ {globalScore}% ]
          </span>
        </div>
      </div>

      {/* Resilience score compacto para mobile */}
      <div className="flex md:hidden items-center gap-1 px-2 py-1 rounded data-value text-[10px] ml-auto"
        style={{ border: `1px solid ${scoreColor}35`, background: `${scoreColor}09` }}>
        <span className="font-bold tabular-nums"
          style={{ color: scoreColor, textShadow: `0 0 10px ${scoreColor}80` }}>
          {globalScore}%
        </span>
      </div>

      {/* Right: clock + alerts */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5" style={{ color: "rgba(71,85,105,0.55)" }}>
          <Clock size={11} />
          <span className="data-value text-[11px] tabular-nums tracking-widest">
            [ {now ? now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"} ]
          </span>
        </div>

        <button
          className="relative flex items-center gap-1.5 px-2 py-1 rounded data-value text-[10px] transition-colors"
          style={{
            color:      alertColor,
            border:     `1px solid ${alertColor}30`,
            background: `${alertColor}08`,
          }}
        >
          <Bell size={11} />
          <span className="hidden sm:inline">[ {unack.length} ] ALERTAS</span>
          <span className="sm:hidden">{unack.length}</span>
          {(hasCrit || hasWarn) && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ background: alertColor, boxShadow: `0 0 6px ${alertColor}`, animation: "blink 1.2s step-end infinite" }}
            />
          )}
        </button>
      </div>
    </header>
  );
}

function StatusPill({ icon, label, value, ok }: {
  icon: React.ReactNode; label: string; value: string; ok: boolean;
}) {
  const c = ok ? "#10B981" : "#F43F5E";
  return (
    <div className="flex items-center gap-1.5 data-value text-[10px]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 5px ${c}` }} />
      <span style={{ color: "rgba(71,85,105,0.7)" }}>{label}</span>
      <span style={{ color: "rgba(148,163,184,0.75)" }}>[ {value} ]</span>
    </div>
  );
}
