"use client";

/**
 * ProvisioningView — Alta de Nuevos Sitios y Equipos
 *
 * Flujo operativo:
 *   1. Operador selecciona o crea un nuevo sitio
 *   2. Elige plantilla maestra RouterOS según tipo de conectividad
 *   3. Completa datos del equipo (modelo, IP, coordenadas)
 *   4. Sistema ejecuta deploy secuencial simulando comandos RouterOS
 *   5. El nuevo sitio queda disponible en el CORE-Map automáticamente
 *
 * TODO: conectar a POST /api/mikrotik/provision
 */

import { useState, useRef }       from "react";
import { useNetwork }             from "@/context/NetworkContext";
import {
  PROVISIONING_TEMPLATES,
  MOCK_PROVISIONING_HISTORY,
}                                 from "@/lib/telemetry/mock-data";
import type {
  ProvisioningTemplate,
  ProvisioningJob,
  ProvisioningStep,
  NewSiteFormData,
  HardwareModel,
} from "@/types/telemetry";
import {
  Zap, Plus, CheckCircle2, XCircle, Clock, Loader2,
  ChevronRight, ChevronDown, Terminal, MapPin, Cpu,
  Wifi, Radio, Satellite, Server,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const HARDWARE_OPTIONS: HardwareModel[] = [
  "MikroTik hEX S",
  "MikroTik RB760iGS",
  "MikroTik RB4011",
  "MikroTik CCR2004",
  "MikroTik hAP ax³",
];

const SITE_TYPES = [
  { value: "branch",       label: "Sucursal"      },
  { value: "remote",       label: "Sitio Remoto"  },
  { value: "studio",       label: "Estudio"       },
  { value: "headquarters", label: "Casa Central"  },
] as const;

const WAN_TYPES = [
  { value: "fiber",     label: "Fibra Óptica",  icon: Wifi    },
  { value: "starlink",  label: "Starlink",       icon: Satellite },
  { value: "radiolink", label: "Radioenlace",    icon: Radio   },
];

const LINK_TYPE_COLOR: Record<string, string> = {
  fiber:     "#4F46E5",
  starlink:  "#94a3b8",
  radiolink: "#10B981",
};

type Tab = "nuevo" | "historial";

// ── Deploy simulation ──────────────────────────────────────────────────────────

function buildSteps(templateId: string, siteName: string): ProvisioningStep[] {
  const base: ProvisioningStep[] = [
    { label: "Conectar a RouterOS API",   command: "/system identity print",                   status: "pending" },
    { label: "Verificar versión firmware",command: "/system resource print",                   status: "pending" },
    { label: "Importar reglas firewall",  command: "/ip firewall filter import tpl-fw.rsc",    status: "pending" },
    { label: "Configurar interfaces WAN", command: "/interface ethernet set ether1 name=wan1", status: "pending" },
    { label: "Aplicar pool DHCP",        command: "/ip dhcp-server setup",                    status: "pending" },
  ];

  const perTemplate: Record<string, ProvisioningStep[]> = {
    "tpl-fiber-branch": [
      { label: "Configurar WireGuard VPN",  command: "/interface wireguard import tpl-wg.rsc",  status: "pending" },
      { label: "Ruta failover Starlink",    command: "/ip route import tpl-failover.rsc",       status: "pending" },
      { label: "QoS 3 capas",              command: "/queue tree import tpl-qos-3l.rsc",        status: "pending" },
    ],
    "tpl-starlink-remote": [
      { label: "Optimizar MTU Starlink",    command: "/ip dhcp-client set interface=ether1 add-default-route=yes", status: "pending" },
      { label: "Configurar IPsec",          command: "/ip ipsec import tpl-ipsec.rsc",          status: "pending" },
    ],
    "tpl-radiolink-field": [
      { label: "Configurar WireGuard VPN",  command: "/interface wireguard import tpl-wg.rsc",  status: "pending" },
      { label: "OSPF para routing dinámico",command: "/routing ospf import tpl-ospf.rsc",       status: "pending" },
      { label: "QoS prioridad VoIP",        command: "/queue tree import tpl-qos-voip.rsc",     status: "pending" },
    ],
    "tpl-hq-full": [
      { label: "BGP eBGP config",           command: "/routing bgp import tpl-bgp.rsc",         status: "pending" },
      { label: "SD-WAN policy routing",     command: "/routing rule import tpl-sdwan.rsc",      status: "pending" },
      { label: "VLAN segmentación",         command: "/interface vlan import tpl-vlan.rsc",     status: "pending" },
      { label: "QoS 5 capas",              command: "/queue tree import tpl-qos-5l.rsc",        status: "pending" },
    ],
  };

  const extra = perTemplate[templateId] ?? [];
  const verify: ProvisioningStep = {
    label:   "Verificar conectividad",
    command: `/tool ping 8.8.8.8 count=3 src-address=${siteName.toLowerCase().replace(/\s/g,"-")}`,
    status:  "pending",
  };

  return [...base, ...extra, verify];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProvisioningView() {
  const { snapshot }              = useNetwork();
  const [tab, setTab]             = useState<Tab>("nuevo");
  const [selectedTpl, setTpl]     = useState<ProvisioningTemplate | null>(null);
  const [jobs, setJobs]           = useState<ProvisioningJob[]>(MOCK_PROVISIONING_HISTORY);
  const [activeJob, setActiveJob] = useState<ProvisioningJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const runningRef = useRef(false);

  const [form, setForm] = useState<NewSiteFormData>({
    name: "", shortName: "", type: "branch",
    coords: { lat: -34.6, lng: -58.4 },
    templateId: "",
    hardware: "MikroTik hEX S",
    provider: "",
    wanType: "fiber",
    bandwidthMbps: 100,
    publicIP: "",
  });

  const provisionedSites = snapshot.sites.map(s => s.id);
  const isFormValid = form.name.trim() && form.shortName.trim() && form.templateId && form.provider.trim();

  const handleDeploy = () => {
    if (!isFormValid || !selectedTpl || runningRef.current) return;
    runningRef.current = true;

    const steps = buildSteps(form.templateId, form.name);
    const job: ProvisioningJob = {
      id:          `job-${Date.now()}`,
      siteId:      `site-${form.shortName.toLowerCase()}`,
      siteName:    form.name,
      templateId:  form.templateId,
      hardware:    form.hardware,
      status:      "running",
      startedAt:   new Date().toISOString(),
      steps,
    };

    setActiveJob({ ...job });
    setJobs(prev => [job, ...prev]);
    setTab("historial");
    setExpandedJob(job.id);

    // Simula ejecución paso a paso
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        const completed: ProvisioningJob = {
          ...job,
          status:      "success",
          completedAt: new Date().toISOString(),
          steps: steps.map(s => ({ ...s, status: "success" as const,
            log: s.command.startsWith("/tool ping") ? "3 packets OK, avg 9ms" : "done" })),
        };
        setActiveJob(completed);
        setJobs(prev => prev.map(j => j.id === job.id ? completed : j));
        runningRef.current = false;
        return;
      }

      const updatedSteps = steps.map((s, idx) => ({
        ...s,
        status: idx < i ? "success" as const
               : idx === i ? "running" as const
               : "pending" as const,
        log: idx < i ? "done" : undefined,
      }));

      const running: ProvisioningJob = { ...job, status: "running", steps: updatedSteps };
      setActiveJob(running);
      setJobs(prev => prev.map(j => j.id === job.id ? running : j));

      i++;
      setTimeout(tick, 600 + Math.random() * 500);
    };

    setTimeout(tick, 400);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(79,70,229,0.15)", background: "rgba(0,4,14,0.88)" }}>
        <div className="flex items-center gap-3">
          <Zap size={14} style={{ color: "#4F46E5" }} />
          <span className="data-value text-sm font-semibold tracking-widest" style={{ color: "#818cf8" }}>
            PROVISIONING VELOZ
          </span>
          <span className="data-value text-[9px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>
            · Alta de Equipos · Plantillas Maestras RouterOS
          </span>
        </div>
        <div className="flex items-center gap-6">
          <ProvStat label="SITIOS ACTIVOS"  value={snapshot.sites.length}             color="#10B981" />
          <ProvStat label="DEPLOYMENTS"     value={jobs.length}                       color="#4F46E5" />
          <ProvStat label="EXITOSOS"        value={jobs.filter(j=>j.status==="success").length} color="#06B6D4" />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex border-b" style={{ borderColor: "rgba(79,70,229,0.12)" }}>
        {(["nuevo", "historial"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="data-value text-[10px] tracking-widest uppercase px-6 py-2.5 transition-colors"
            style={{
              color:        tab === t ? "#818cf8" : "rgba(100,116,139,0.6)",
              borderBottom: tab === t ? "1px solid #4F46E5" : "1px solid transparent",
              background:   tab === t ? "rgba(79,70,229,0.05)" : "transparent",
            }}>
            {t === "nuevo" ? "➕ Nuevo Sitio / Equipo" : `📋 Historial (${jobs.length})`}
          </button>
        ))}
      </div>

      {/* ── NUEVO SITIO ─────────────────────────────────────────────────── */}
      {tab === "nuevo" && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left: form */}
          <div className="w-[440px] flex-shrink-0 flex flex-col border-r overflow-y-auto"
            style={{ borderColor: "rgba(79,70,229,0.12)" }}>

            <div className="p-5 space-y-4">
              <SectionLabel icon={<MapPin size={10}/>} label="Datos del Sitio" />

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="NOMBRE DEL SITIO">
                  <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                    placeholder="Ej: Nueva Sucursal Quilmes"
                    className="hud-input w-full" />
                </Field>
                <Field label="CÓDIGO CORTO">
                  <input value={form.shortName} onChange={e => setForm(p => ({...p, shortName: e.target.value.toUpperCase().slice(0,5)}))}
                    placeholder="QUI"
                    className="hud-input w-full" />
                </Field>
              </div>

              {/* Type */}
              <Field label="TIPO DE SITIO">
                <div className="grid grid-cols-4 gap-1.5">
                  {SITE_TYPES.map(st => (
                    <button key={st.value} onClick={() => setForm(p => ({...p, type: st.value}))}
                      className="data-value text-[9px] py-1.5 rounded text-center transition-all"
                      style={{
                        border:  `1px solid ${form.type === st.value ? "rgba(79,70,229,0.5)" : "rgba(255,255,255,0.07)"}`,
                        background: form.type === st.value ? "rgba(79,70,229,0.12)" : "transparent",
                        color: form.type === st.value ? "#818cf8" : "rgba(100,116,139,0.7)",
                      }}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Coords */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="LATITUD">
                  <input type="number" value={form.coords.lat}
                    onChange={e => setForm(p => ({...p, coords: {...p.coords, lat: parseFloat(e.target.value)||0}}))}
                    step="0.01" className="hud-input w-full" />
                </Field>
                <Field label="LONGITUD">
                  <input type="number" value={form.coords.lng}
                    onChange={e => setForm(p => ({...p, coords: {...p.coords, lng: parseFloat(e.target.value)||0}}))}
                    step="0.01" className="hud-input w-full" />
                </Field>
              </div>

              <SectionLabel icon={<Wifi size={10}/>} label="Conectividad WAN" />

              {/* WAN type */}
              <Field label="TIPO DE ENLACE">
                <div className="grid grid-cols-3 gap-1.5">
                  {WAN_TYPES.map(wt => {
                    const Icon = wt.icon;
                    const active = form.wanType === wt.value;
                    const c = LINK_TYPE_COLOR[wt.value];
                    return (
                      <button key={wt.value} onClick={() => setForm(p => ({...p, wanType: wt.value as typeof p.wanType}))}
                        className="flex items-center justify-center gap-1.5 data-value text-[9px] py-2 rounded transition-all"
                        style={{
                          border:     `1px solid ${active ? c + "60" : "rgba(255,255,255,0.07)"}`,
                          background: active ? `${c}12` : "transparent",
                          color:      active ? c : "rgba(100,116,139,0.7)",
                        }}>
                        <Icon size={10}/>{wt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="PROVEEDOR ISP">
                  <input value={form.provider} onChange={e => setForm(p => ({...p, provider: e.target.value}))}
                    placeholder="Movistar, Fibertel…"
                    className="hud-input w-full" />
                </Field>
                <Field label="ANCHO DE BANDA (Mbps)">
                  <input type="number" value={form.bandwidthMbps}
                    onChange={e => setForm(p => ({...p, bandwidthMbps: parseInt(e.target.value)||100}))}
                    className="hud-input w-full" />
                </Field>
              </div>

              <Field label="IP PÚBLICA (opcional)">
                <input value={form.publicIP} onChange={e => setForm(p => ({...p, publicIP: e.target.value}))}
                  placeholder="200.x.x.x"
                  className="hud-input w-full" />
              </Field>

              <SectionLabel icon={<Cpu size={10}/>} label="Equipo" />

              <Field label="MODELO MIKROTIK">
                <select value={form.hardware}
                  onChange={e => setForm(p => ({...p, hardware: e.target.value as HardwareModel}))}
                  className="hud-input w-full">
                  {HARDWARE_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Right: templates + deploy */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Templates */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <SectionLabel icon={<Server size={10}/>} label="Plantilla Maestra RouterOS" />
              <p className="data-value text-[9px]" style={{ color: "rgba(71,85,105,0.6)" }}>
                Seleccioná la plantilla que se aplicará al equipo via RouterOS API al hacer deploy.
              </p>

              {PROVISIONING_TEMPLATES.map(tpl => {
                const isSelected = selectedTpl?.id === tpl.id;
                const lc = LINK_TYPE_COLOR[tpl.wanType];
                return (
                  <button key={tpl.id}
                    onClick={() => { setTpl(tpl); setForm(p => ({...p, templateId: tpl.id})); }}
                    className="w-full text-left p-4 rounded-lg transition-all"
                    style={{
                      border:     `1px solid ${isSelected ? "rgba(79,70,229,0.45)" : "rgba(79,70,229,0.12)"}`,
                      background: isSelected ? "rgba(79,70,229,0.08)" : "rgba(0,6,20,0.5)",
                      boxShadow:  isSelected ? "0 0 16px rgba(79,70,229,0.08)" : "none",
                    }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: "#4F46E5", boxShadow: "0 0 5px #4F46E5" }} />}
                        <span className="data-value text-[11px] font-semibold"
                          style={{ color: isSelected ? "#818cf8" : "rgba(226,232,240,0.85)" }}>
                          {tpl.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Clock size={9} style={{ color: "rgba(71,85,105,0.6)" }} />
                        <span className="data-value text-[8.5px]" style={{ color: "rgba(71,85,105,0.6)" }}>
                          ~{tpl.estimatedSeconds}s
                        </span>
                      </div>
                    </div>

                    <p className="data-value text-[9.5px] mb-3" style={{ color: "rgba(100,116,139,0.7)" }}>
                      {tpl.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tpl.features.map(f => (
                        <span key={f} className="data-value text-[8px] px-1.5 py-0.5 rounded"
                          style={{ color: "rgba(129,140,248,0.8)", background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.2)" }}>
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <span className="data-value text-[8px] px-1.5 py-0.5 rounded"
                        style={{ color: lc, background: `${lc}12`, border: `1px solid ${lc}25` }}>
                        WAN: {tpl.wanType.toUpperCase()}
                      </span>
                      <span className="data-value text-[8px]" style={{ color: "rgba(71,85,105,0.55)" }}>
                        HW: {tpl.hardware.join(", ")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Deploy button */}
            <div className="flex-shrink-0 p-5 border-t" style={{ borderColor: "rgba(79,70,229,0.12)" }}>
              {!isFormValid && (
                <p className="data-value text-[9px] mb-3 text-center" style={{ color: "rgba(71,85,105,0.6)" }}>
                  Completá nombre, código, proveedor y seleccioná una plantilla para habilitar el deploy.
                </p>
              )}
              <button
                onClick={handleDeploy}
                disabled={!isFormValid}
                className="w-full py-3 rounded-lg data-value text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all"
                style={{
                  background:  isFormValid ? "rgba(79,70,229,0.15)" : "rgba(255,255,255,0.03)",
                  border:      `1px solid ${isFormValid ? "rgba(79,70,229,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color:       isFormValid ? "#818cf8" : "rgba(71,85,105,0.4)",
                  cursor:      isFormValid ? "pointer" : "not-allowed",
                  boxShadow:   isFormValid ? "0 0 20px rgba(79,70,229,0.1)" : "none",
                }}>
                <Zap size={13} />
                Iniciar Provisioning
              </button>
              {selectedTpl && (
                <p className="data-value text-[8px] mt-2 text-center" style={{ color: "rgba(71,85,105,0.5)" }}>
                  Tiempo estimado: ~{selectedTpl.estimatedSeconds}s · TODO: POST /api/mikrotik/provision
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ───────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Zap size={24} style={{ color: "#4F46E5", opacity: 0.3 }} />
              <span className="data-value text-[10px]" style={{ color: "rgba(71,85,105,0.6)" }}>
                No hay provisionings realizados
              </span>
            </div>
          )}

          {jobs.map(job => {
            const isExpanded = expandedJob === job.id;
            const isRunning  = job.status === "running";
            const sc = job.status === "success" ? "#10B981"
                     : job.status === "running"  ? "#4F46E5"
                     : job.status === "error"    ? "#F43F5E"
                     : "#F59E0B";

            const liveJob = isRunning && activeJob?.id === job.id ? activeJob : job;

            return (
              <div key={job.id} className="rounded-lg overflow-hidden"
                style={{ border: `1px solid ${sc}22`, background: "rgba(0,6,20,0.6)" }}>

                {/* Job header */}
                <button
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ background: `${sc}06` }}>
                  <div className="flex items-center gap-3">
                    {isRunning
                      ? <Loader2 size={13} className="animate-spin" style={{ color: sc }} />
                      : job.status === "success"
                        ? <CheckCircle2 size={13} style={{ color: sc }} />
                        : <XCircle size={13} style={{ color: sc }} />
                    }
                    <div>
                      <span className="data-value text-[11px] font-semibold"
                        style={{ color: "rgba(226,232,240,0.9)" }}>
                        {job.siteName}
                      </span>
                      <span className="data-value text-[9px] ml-2" style={{ color: "rgba(71,85,105,0.7)" }}>
                        {PROVISIONING_TEMPLATES.find(t => t.id === job.templateId)?.name ?? job.templateId}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="data-value text-[8.5px]" style={{ color: sc }}>
                      {job.status.toUpperCase()}
                    </span>
                    <span className="data-value text-[8px]" style={{ color: "rgba(71,85,105,0.5)" }}>
                      {new Date(job.startedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span style={{ color: "rgba(71,85,105,0.5)" }}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  </div>
                </button>

                {/* Steps terminal */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Terminal size={9} style={{ color: "rgba(79,70,229,0.5)" }} />
                      <span className="data-value text-[8px] tracking-widest"
                        style={{ color: "rgba(71,85,105,0.5)" }}>
                        RouterOS · {job.hardware}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[9px]">
                      {liveJob.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5 w-3">
                            {step.status === "success" ? <CheckCircle2 size={9} style={{ color: "#10B981" }} />
                             : step.status === "running" ? <Loader2 size={9} className="animate-spin" style={{ color: "#4F46E5" }} />
                             : step.status === "error"   ? <XCircle size={9} style={{ color: "#F43F5E" }} />
                             : <span style={{ color: "rgba(71,85,105,0.4)" }}>·</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span style={{ color: step.status === "pending" ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.8)" }}>
                              {step.label}
                            </span>
                            {step.status !== "pending" && (
                              <span className="ml-2 text-[8px]"
                                style={{ color: "rgba(71,85,105,0.55)" }}>
                                › <span style={{ color: "rgba(79,70,229,0.6)" }}>{step.command}</span>
                              </span>
                            )}
                            {step.log && (
                              <span className="ml-2 text-[8px]" style={{ color: "#10B981" }}>
                                ✓ {step.log}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {liveJob.status === "success" && liveJob.completedAt && (
                      <div className="mt-3 pt-2 border-t flex items-center gap-2"
                        style={{ borderColor: "rgba(16,185,129,0.15)" }}>
                        <CheckCircle2 size={10} style={{ color: "#10B981" }} />
                        <span className="data-value text-[9px]" style={{ color: "#10B981" }}>
                          Sitio aprovisionado exitosamente — disponible en CORE-Map
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProvStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="data-value text-[18px] font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 10px ${color}50` }}>{value}</div>
      <div className="data-value text-[8px] tracking-widest" style={{ color: "rgba(71,85,105,0.6)" }}>{label}</div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span style={{ color: "rgba(79,70,229,0.6)" }}>{icon}</span>
      <span className="data-value text-[9px] tracking-widest uppercase"
        style={{ color: "rgba(79,70,229,0.65)" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(79,70,229,0.12)" }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="data-value text-[8.5px] tracking-widest uppercase block"
        style={{ color: "rgba(71,85,105,0.65)" }}>{label}</label>
      {children}
    </div>
  );
}
