"use client";

import { useState }           from "react";
import { useNetwork }          from "@/context/NetworkContext";
import CoreMap                 from "@/components/core-map/CoreMap";
import ResilienceScore         from "@/components/ui/ResilienceScore";
import MissionModeButtons      from "@/components/ui/MissionModeButtons";
import AlertFeed               from "@/components/ui/AlertFeed";
import ISPMonitor              from "@/components/ui/ISPMonitor";
import type { Site }           from "@/types/telemetry";
import {
  Activity, BarChart2, Globe2, ShieldCheck,
  Network, Server, Wifi, Radio, Satellite,
  Shield, Users, Cpu, Zap,
} from "lucide-react";

type LeftTab   = "sdwan" | "isp";
type MobileTab = "mapa" | "panel" | "sitios";

export default function ResilienciaView() {
  const { snapshot: data, isps, missionMode, setMissionMode } = useNetwork();
  const [leftTab,   setLeftTab]   = useState<LeftTab>("sdwan");
  const [mobileTab, setMobileTab] = useState<MobileTab>("mapa");

  const failedLinks  = data.sites.flatMap(s => s.links).filter(l => l.status === "failed").length;
  const congested    = data.sites.flatMap(s => s.links).some(l => l.status === "active" && l.usageMbps / l.bandwidthMbps > 0.85);
  const backupSat    = data.sites.flatMap(s => s.links).some(l => l.status === "standby" && l.usageMbps / l.bandwidthMbps > 0.7);
  const ispDegraded  = isps.filter(p => p.healthScore < 90).length;
  const scoreColor   = data.globalResilienceScore >= 90 ? "#10B981"
                     : data.globalResilienceScore >= 70 ? "#F59E0B"
                     : "#F43F5E";

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* ── Mobile tab strip ────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-shrink-0 border-b" style={{ borderColor: "rgba(79,70,229,0.15)" }}>
        {(["mapa", "panel", "sitios"] as MobileTab[]).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className="flex-1 py-2.5 data-value text-[10px] tracking-widest uppercase transition-colors"
            style={{
              color:        mobileTab === tab ? "#818cf8" : "rgba(71,85,105,0.6)",
              borderBottom: mobileTab === tab ? "1px solid #4F46E5" : "1px solid transparent",
              background:   mobileTab === tab ? "rgba(79,70,229,0.06)" : "transparent",
            }}>
            {tab === "mapa" ? "CORE-Map" : tab === "panel" ? "SD-WAN" : "Sitios"}
          </button>
        ))}
      </div>

      {/* ── Main content: 3 columns on desktop, tabs on mobile ──────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <aside
        className={`${mobileTab === "panel" ? "flex" : "hidden"} md:flex w-full md:w-72 flex-shrink-0 flex-col border-r overflow-hidden scan-in`}
        style={{ borderColor: "rgba(79,70,229,0.12)" }}>

        <div className="flex flex-shrink-0 border-b" style={{ borderColor: "rgba(79,70,229,0.12)" }}>
          <PanelTab icon={<Activity size={11} />}  label="SD-WAN"      active={leftTab === "sdwan"} onClick={() => setLeftTab("sdwan")} />
          <PanelTab icon={<BarChart2 size={11} />} label="ISP Monitor" active={leftTab === "isp"}   onClick={() => setLeftTab("isp")}  badge={ispDegraded || undefined} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {leftTab === "sdwan" ? (
            <>
              <div className="glass rounded-lg px-3 py-3 space-y-2" style={{ borderColor: "rgba(79,70,229,0.12)" }}>
                <span className="data-value text-[9px] tracking-widest uppercase block mb-1" style={{ color: "rgba(71,85,105,0.7)" }}>Estado de Red</span>
                <NetPill icon={<Wifi size={10} />}    label="SD-WAN"   value={`${data.sites.length} sitios activos`}                                              ok={failedLinks === 0} />
                <NetPill icon={<Network size={10} />} label="VPN"      value={`${data.flows.length} túneles cifrados`}                                            ok />
                <NetPill icon={<Shield size={10} />}  label="Firewall" value={`${data.sites.filter(s => s.firewallEnabled).length}/${data.sites.length} activos`} ok />
                <NetPill icon={<Server size={10} />}  label="Sitios"   value={`${data.sites.filter(s => s.status === "operational").length} operacionales`}       ok={data.sites.every(s => s.status !== "offline")} />
              </div>

              <div className="glass rounded-lg p-4 hud-corners" style={{ borderColor: "rgba(79,70,229,0.12)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full status-dot"
                    style={{ backgroundColor: scoreColor, boxShadow: `0 0 5px ${scoreColor}` }} />
                  <span className="data-value text-[9px] tracking-widest uppercase" style={{ color: "rgba(71,85,105,0.7)" }}>
                    Resilience Score Global
                  </span>
                </div>
                <ResilienceScore score={data.globalResilienceScore} size="lg" showLabel showInsight
                  insightContext={{ failedLinks, congested, backupSaturated: backupSat }} />
              </div>

              <div className="glass rounded-lg p-4" style={{ borderColor: "rgba(79,70,229,0.10)" }}>
                <MissionModeButtons currentMode={missionMode} onModeChange={setMissionMode} />
              </div>

              <div className="glass rounded-lg p-4" style={{ borderColor: "rgba(79,70,229,0.10)" }}>
                <AlertFeed alerts={data.activeAlerts} />
              </div>
            </>
          ) : (
            <ISPMonitor providers={isps} />
          )}
        </div>
      </aside>

      {/* ── CENTER: CORE-Map ───────────────────────────────────────────────── */}
      <main className={`${mobileTab === "mapa" ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0 overflow-hidden`}>
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "rgba(79,70,229,0.10)", background: "rgba(0,8,20,0.6)" }}>
          <div className="flex items-center gap-3">
            <Globe2 size={13} style={{ color: "rgba(79,70,229,0.7)" }} />
            <span className="data-value text-[10px] tracking-widest uppercase" style={{ color: "rgba(79,70,229,0.7)" }}>
              CORE-Map · Vista Georreferenciada
            </span>
            {missionMode !== "normal" && (
              <span className="data-value text-[9px] font-bold px-2 py-0.5 rounded tracking-widest"
                style={{
                  color:       missionMode === "contingency" ? "#F59E0B" : "#F43F5E",
                  border:     `1px solid ${missionMode === "contingency" ? "rgba(245,158,11,0.3)" : "rgba(244,63,94,0.3)"}`,
                  background:  missionMode === "contingency" ? "rgba(245,158,11,0.08)" : "rgba(244,63,94,0.08)",
                  animation:   "blink 1.2s step-end infinite",
                }}>
                MODO {missionMode === "contingency" ? "CONTINGENCIA" : "CIERRE"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <MapKpi icon={<ShieldCheck size={10} />} label="Firewall" value={`${data.sites.filter(s => s.firewallEnabled).length}/${data.sites.length}`}    color="#10B981" />
            <MapKpi icon={<Network size={10} />}     label="VPN"      value={`[ ${data.flows.length} flujos ]`}   color="#4F46E5" />
            <MapKpi icon={<Server size={10} />}      label="Sitios"   value={`[ ${data.sites.length} activos ]`}  color="#06B6D4" />
            <MapKpi icon={<Globe2 size={10} />}      label="Score"    value={`[ ${data.globalResilienceScore}% ]`} color={scoreColor} />
          </div>
          <span className="data-value text-[9px]" style={{ color: "rgba(71,85,105,0.6)" }}
            suppressHydrationWarning>
            {new Date(data.timestamp).toLocaleTimeString("es-AR")}
          </span>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <CoreMap sites={data.sites} flows={data.flows} className="w-full h-full" />
        </div>
      </main>

      {/* ── RIGHT PANEL: Site cards ────────────────────────────────────────── */}
      <aside
        className={`${mobileTab === "sitios" ? "flex" : "hidden"} md:flex w-full md:w-80 flex-shrink-0 flex-col border-l overflow-hidden`}
        style={{ borderColor: "rgba(79,70,229,0.10)" }}>
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "rgba(79,70,229,0.10)", background: "rgba(0,8,20,0.5)" }}>
          <span className="data-value text-[9px] tracking-widest uppercase" style={{ color: "rgba(71,85,105,0.7)" }}>Estado de Sitios</span>
          <span className="w-1.5 h-1.5 rounded-full status-dot" style={{ backgroundColor: "#10B981", boxShadow: "0 0 5px #10B981" }} />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {data.sites.map(site => <HudSiteCard key={site.id} site={site} />)}
        </div>

        <div className="flex-shrink-0 border-t p-3 grid grid-cols-2 gap-3"
          style={{ borderColor: "rgba(79,70,229,0.10)", background: "rgba(0,8,20,0.5)" }}>
          {[
            { icon: <Cpu size={11} />,   label: "Dispositivos", value: data.sites.reduce((a, s) => a + s.connectedDevices, 0), color: "#06B6D4" },
            { icon: <Users size={11} />, label: "Usuarios",     value: data.sites.reduce((a, s) => a + s.activeUsers, 0),      color: "#4F46E5" },
            { icon: <Network size={11}/>,label: "Flujos VPN",   value: data.flows.length,                                       color: "#10B981" },
            { icon: <Zap size={11} />,   label: "Alertas",
              value: data.activeAlerts.filter(a => !a.acknowledged).length,
              color: data.activeAlerts.some(a => !a.acknowledged && a.severity === "critical") ? "#F43F5E" : "#F59E0B" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-1">
              <span style={{ color: "rgba(71,85,105,0.6)" }}>{icon}</span>
              <span className="data-value text-lg font-bold tabular-nums"
                style={{ color, textShadow: `0 0 10px ${color}50` }}>{value}</span>
              <span className="data-value text-[9px] tracking-wider uppercase"
                style={{ color: "rgba(71,85,105,0.7)" }}>{label}</span>
            </div>
          ))}
        </div>
      </aside>

      </div>{/* end 3-col grid */}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PanelTab({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className="flex-1 relative flex items-center justify-center gap-1.5 py-2.5 data-value text-[10px] tracking-wide transition-colors"
      style={{
        color:        active ? "#818cf8" : "rgba(100,116,139,0.7)",
        borderBottom: active ? "1px solid #4F46E5" : "1px solid transparent",
        background:   active ? "rgba(79,70,229,0.05)" : "transparent",
      }}>
      {icon}{label}
      {badge != null && badge > 0 && (
        <span className="absolute top-1.5 right-3 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
          style={{ background: "#F59E0B", color: "#000814" }}>{badge}</span>
      )}
    </button>
  );
}

function NetPill({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  const c = ok ? "#10B981" : "#F43F5E";
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}` }} />
      <span style={{ color: "rgba(71,85,105,0.6)" }}>{icon}</span>
      <span className="data-value text-[10px] flex-1" style={{ color: "rgba(100,116,139,0.8)" }}>{label}</span>
      <span className="data-value text-[10px] font-medium" style={{ color: "rgba(148,163,184,0.85)" }}>{value}</span>
    </div>
  );
}

function MapKpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: "rgba(71,85,105,0.6)" }}>{icon}</span>
      <span className="data-value text-[10px]" style={{ color: "rgba(71,85,105,0.6)" }}>{label}:</span>
      <span className="data-value text-[10px] font-medium" style={{ color, textShadow: `0 0 6px ${color}50` }}>{value}</span>
    </div>
  );
}

const LINK_ICONS: Record<string, React.ElementType> = {
  fiber: Wifi, radiolink: Radio, starlink: Satellite, vpn: Shield,
};

function HudSiteCard({ site }: { site: Site }) {
  const sc = site.status === "operational" ? "#10B981" : site.status === "degraded" ? "#F59E0B" : "#F43F5E";
  const al = site.links.find(l => l.status === "active");
  const up = al ? (al.usageMbps / al.bandwidthMbps) * 100 : 0;

  return (
    <div className="rounded-lg p-3 space-y-2.5 transition-all duration-300"
      style={{ background: "rgba(0,10,30,0.5)", border: `1px solid ${sc}18`, backdropFilter: "blur(12px)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 status-dot" style={{ backgroundColor: sc, boxShadow: `0 0 5px ${sc}` }} />
          <span className="text-sm font-semibold" style={{ color: "rgba(226,232,240,0.95)" }}>{site.name}</span>
        </div>
        <span className="data-value text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ color: sc, background: `${sc}10`, border: `1px solid ${sc}22` }}>{site.shortName}</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="data-value text-[9px] tracking-wider" style={{ color: "rgba(71,85,105,0.7)" }}>RESILIENCIA</span>
          <span className="data-value text-[10px] font-bold" style={{ color: sc, textShadow: `0 0 7px ${sc}70` }}>
            [ {site.resilienceScore}% ]
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${site.resilienceScore}%`, background: sc, boxShadow: `0 0 5px ${sc}` }} />
        </div>
      </div>

      {al && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="data-value text-[9px] tracking-wider" style={{ color: "rgba(71,85,105,0.7)" }}>BW</span>
            <span className="data-value text-[10px]" style={{ color: "rgba(100,116,139,0.7)" }}>
              [ {al.usageMbps.toFixed(0)}/{al.bandwidthMbps} Mbps ]
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, up)}%`, background: up > 85 ? "#F59E0B" : "#4F46E5", boxShadow: up > 85 ? "0 0 5px #F59E0B" : undefined }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {site.links.map(link => {
          const Icon = LINK_ICONS[link.type] ?? Wifi;
          const lc = link.status === "active" ? "#10B981" : link.status === "standby" ? "#F59E0B" : "#F43F5E";
          return (
            <span key={link.id} className="flex items-center gap-1 data-value text-[9px] px-1.5 py-0.5 rounded"
              style={{ color: lc, background: `${lc}0e`, border: `1px solid ${lc}20` }}>
              <Icon size={8} />{link.type.toUpperCase()}
              {link.latencyMs > 0 && ` ${link.latencyMs}ms`}
            </span>
          );
        })}
      </div>
    </div>
  );
}
