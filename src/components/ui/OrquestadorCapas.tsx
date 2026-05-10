"use client";

import { useState } from "react";
import {
  FileText, Shield, FolderOpen,
  Camera, Phone, Video, Youtube,
  Lock, Unlock, AlertTriangle, CheckCircle2,
  Layers,
} from "lucide-react";
import type { MissionMode } from "@/types/telemetry";

interface Service {
  id: string;
  name: string;
  icon: React.ElementType;
  active: boolean;
}

interface TrafficLayer {
  id: string;
  name: string;
  priority: "critical" | "operational" | "leisure";
  allocationPct: number;
  locked: boolean;
  color: string;
  services: Service[];
  description: string;
}

const DEFAULT_LAYERS: TrafficLayer[] = [
  {
    id: "layer-1",
    name: "CAPA 1 (MISIÓN CRÍTICA)",
    priority: "critical",
    allocationPct: 100,
    locked: true,
    color: "#00d4ff",
    description: "Tráfico prioritario garantizado. No interrumpible.",
    services: [
      { id: "s-billing", name: "Facturación", icon: FileText, active: true },
      { id: "s-vpn",     name: "VPN",         icon: Shield,   active: true },
      { id: "s-bim",     name: "Archivos BIM", icon: FolderOpen, active: true },
    ],
  },
  {
    id: "layer-2",
    name: "CAPA 2 (OPERACIÓN)",
    priority: "operational",
    allocationPct: 50,
    locked: false,
    color: "#10b981",
    description: "Operaciones estándar. Reducible en contingencia.",
    services: [
      { id: "s-cam",  name: "Cámaras IP", icon: Camera, active: true },
      { id: "s-voip", name: "VoIP",        icon: Phone,  active: true },
    ],
  },
  {
    id: "layer-3",
    name: "CAPA 3 (OCIO/NO CRÍTICO)",
    priority: "leisure",
    allocationPct: 0,
    locked: true,
    color: "#ef4444",
    description: "Bloqueado. Disponible para liberación manual.",
    services: [
      { id: "s-video",   name: "Streaming", icon: Video,   active: false },
      { id: "s-youtube", name: "YouTube",   icon: Youtube, active: false },
    ],
  },
];

interface OrquestadorCapasProps {
  missionMode: MissionMode;
  onModeChange?: (mode: MissionMode) => void;
}

export default function OrquestadorCapas({ missionMode, onModeChange }: OrquestadorCapasProps) {
  const [layers, setLayers] = useState<TrafficLayer[]>(DEFAULT_LAYERS);
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);

  const handleReleaseLayer3 = () => {
    setReleasing(true);
    setTimeout(() => {
      setLayers(prev => prev.map(l =>
        l.id === "layer-3"
          ? { ...l, locked: false, allocationPct: 30, services: l.services.map(s => ({ ...s, active: true })) }
          : l
      ));
      setReleased(true);
      setReleasing(false);
    }, 1200);
  };

  const handleContingency = () => {
    onModeChange?.("contingency");
    setLayers(prev => prev.map(l =>
      l.id === "layer-1" ? { ...l, allocationPct: 100 } :
      l.id === "layer-2" ? { ...l, allocationPct: 0, services: l.services.map(s => ({ ...s, active: false })) } :
      { ...l, allocationPct: 0, locked: true, services: l.services.map(s => ({ ...s, active: false })) }
    ));
  };

  const isContingency = missionMode === "contingency";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "rgba(0,212,255,0.08)" }}>
        <Layers size={13} style={{ color: "rgba(0,212,255,0.6)" }} />
        <div>
          <p className="data-value text-xs font-bold tracking-widest" style={{ color: "rgba(0,212,255,0.8)" }}>
            ORQUESTADOR DE CAPAS
          </p>
          <p className="data-value text-[9px] tracking-wide" style={{ color: "rgba(71,85,105,0.7)" }}>
            Tactile drag &amp; drop flow controls
          </p>
        </div>
      </div>

      {/* Layers */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {layers.map(layer => (
          <LayerCard key={layer.id} layer={layer} isContingency={isContingency} />
        ))}

        {/* Liberar Capa 3 */}
        {!released ? (
          <button
            onClick={handleReleaseLayer3}
            disabled={releasing || isContingency}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded data-value text-xs font-bold tracking-widest transition-all duration-200"
            style={{
              border: "1px solid rgba(245,158,11,0.35)",
              background: releasing ? "rgba(245,158,11,0.05)" : "rgba(245,158,11,0.08)",
              color: isContingency ? "rgba(71,85,105,0.5)" : "#f59e0b",
            }}
          >
            <Unlock size={12} />
            {releasing ? "LIBERANDO..." : "[ LIBERAR CAPA 3 ]"}
          </button>
        ) : (
          <div className="flex items-center gap-2 py-2 px-3 rounded data-value text-xs"
            style={{ border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.06)", color: "#10b981" }}>
            <CheckCircle2 size={12} />
            <span>Capa 3 activa</span>
            <span className="ml-auto text-[9px] opacity-60">−15% facturación</span>
          </div>
        )}

        {/* Savings note */}
        {!isContingency && (
          <p className="data-value text-[9px] text-center px-2" style={{ color: "rgba(71,85,105,0.6)" }}>
            {released ? "★ Liberar Capa 3 reduce facturación 15%" : "Liberar Capa 3 reduce facturación 15%"}
          </p>
        )}
      </div>

      {/* Activar Contingencia CTA */}
      <div className="flex-shrink-0 p-3 border-t" style={{ borderColor: "rgba(0,212,255,0.08)" }}>
        <button
          onClick={handleContingency}
          disabled={isContingency}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded data-value text-xs font-bold tracking-widest transition-all duration-200 relative overflow-hidden"
          style={{
            border: isContingency ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(239,68,68,0.5)",
            background: isContingency ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
            color: isContingency ? "rgba(239,68,68,0.6)" : "#ef4444",
          }}
        >
          <AlertTriangle size={13} />
          {isContingency ? "MODO CONTINGENCIA ACTIVO" : "[ ACTIVAR MODO CONTINGENCIA ]"}
          {!isContingency && (
            <span className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)" }} />
          )}
        </button>
        <p className="data-value text-[9px] text-center mt-1.5" style={{ color: "rgba(71,85,105,0.5)" }}>
          {isContingency ? "TAPA VIRTUAL·PROTECTED" : "Prioriza Capa 1 · Suspende Capas 2 y 3"}
        </p>
      </div>
    </div>
  );
}

// ── Layer Card ─────────────────────────────────────────────────────────────

function LayerCard({ layer, isContingency }: { layer: TrafficLayer; isContingency: boolean }) {
  const isBlocked = layer.allocationPct === 0 && layer.locked;
  const isActive  = layer.allocationPct > 0;

  const pct = isContingency && layer.priority !== "critical" ? 0 : layer.allocationPct;

  return (
    <div
      className="rounded-lg p-3 space-y-2.5 transition-all duration-500"
      style={{
        background: isBlocked ? "rgba(0,5,16,0.4)" : "rgba(0,10,30,0.5)",
        border: `1px solid ${isBlocked ? "rgba(239,68,68,0.2)" : `${layer.color}20`}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isBlocked ? (
            <Lock size={10} style={{ color: "#ef4444" }} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full status-dot"
              style={{ backgroundColor: layer.color, boxShadow: `0 0 5px ${layer.color}` }} />
          )}
          <span className="data-value text-[10px] font-bold tracking-wide"
            style={{ color: isBlocked ? "rgba(239,68,68,0.7)" : layer.color }}>
            {layer.name}
          </span>
        </div>
        <span
          className="data-value text-[10px] font-bold"
          style={{ color: isBlocked ? "rgba(239,68,68,0.6)" : layer.color, textShadow: `0 0 6px ${layer.color}60` }}
        >
          {isContingency && layer.priority !== "critical" ? "0%" : `${layer.allocationPct}%`}
        </span>
      </div>

      {/* Allocation bar */}
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isBlocked ? "rgba(239,68,68,0.4)" : layer.color,
            boxShadow: pct > 0 ? `0 0 8px ${layer.color}60` : undefined,
          }}
        />
        {isBlocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-px" style={{ background: "repeating-linear-gradient(90deg,rgba(239,68,68,0.4) 0,rgba(239,68,68,0.4) 4px,transparent 4px,transparent 8px)" }} />
          </div>
        )}
      </div>

      {/* Services */}
      <div className="flex flex-wrap gap-1.5">
        {layer.services.map(svc => {
          const Icon = svc.icon;
          const active = svc.active && !isContingency || (isContingency && layer.priority === "critical");
          return (
            <div key={svc.id}
              className="flex flex-col items-center gap-1 px-2 py-1.5 rounded"
              style={{
                background: active ? `${layer.color}10` : "rgba(0,0,0,0.2)",
                border: `1px solid ${active ? `${layer.color}25` : "rgba(255,255,255,0.05)"}`,
                minWidth: 44,
              }}
            >
              <Icon size={13} style={{ color: active ? layer.color : "rgba(71,85,105,0.4)" }} />
              <span className="data-value text-[8px] text-center"
                style={{ color: active ? "rgba(148,163,184,0.8)" : "rgba(71,85,105,0.4)" }}>
                {svc.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Description */}
      <p className="data-value text-[9px]" style={{ color: "rgba(71,85,105,0.6)" }}>
        {layer.description}
      </p>
    </div>
  );
}
