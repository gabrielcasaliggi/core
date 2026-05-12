"use client";

/**
 * ProvisioningView — Alta de Nuevos Sitios y Equipos
 *
 * Flujo real (con Supabase):
 *   1. Operador completa datos del sitio + credenciales del router
 *   2. Elige plantilla maestra RouterOS
 *   3. Sistema valida conexión al router via API
 *   4. Guarda router en Supabase + ejecuta provisioning
 *   5. El nuevo sitio queda disponible en el CORE-Map automáticamente
 */

import { useState, useRef, useEffect } from "react";
import { useNetwork }             from "@/context/NetworkContext";
import { PROVISIONING_TEMPLATES } from "@/lib/telemetry/mock-data";
import type {
  ProvisioningTemplate,
  ProvisioningJob,
  ProvisioningStep,
  NewSiteFormData,
  HardwareModel,
} from "@/types/telemetry";
import type { ProvisioningJobRow } from "@/lib/supabase/types";
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

// ── Conversión Supabase row → tipo local ───────────────────────────────────────

function rowToJob(row: ProvisioningJobRow): ProvisioningJob {
  return {
    id:          row.id,
    siteId:      (row.metadata as { site_id?: string } | null)?.site_id ?? "—",
    siteName:    row.site_name,
    templateId:  row.template_id,
    hardware:    row.hardware as HardwareModel,
    status:      row.status,
    startedAt:   row.started_at,
    completedAt: row.completed_at ?? undefined,
    steps:       (row.steps as ProvisioningStep[]) ?? [],
  };
}

// ── Deploy simulation (pasos base — Fase 2 reemplaza con ejecución real) ───────

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

// ── Formulario extendido con credenciales del router ─────────────────────────

interface RouterFormData extends NewSiteFormData {
  routerHost:     string;
  routerPort:     number;
  routerProtocol: "http" | "https";
  routerUser:     string;
  routerPass:     string;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProvisioningView() {
  const { snapshot }              = useNetwork();
  const [tab, setTab]             = useState<Tab>("nuevo");
  const [selectedTpl, setTpl]     = useState<ProvisioningTemplate | null>(null);
  const [jobs, setJobs]           = useState<ProvisioningJob[]>([]);
  const [activeJob, setActiveJob] = useState<ProvisioningJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const runningRef = useRef(false);

  const [form, setForm] = useState<RouterFormData>({
    name: "", shortName: "", type: "branch",
    coords: { lat: -34.6, lng: -58.4 },
    templateId: "",
    hardware: "MikroTik hEX S",
    provider: "",
    wanType: "fiber",
    bandwidthMbps: 100,
    publicIP: "",
    routerHost:     "",
    routerPort:     80,
    routerProtocol: "http",
    routerUser:     "admin",
    routerPass:     "",
  });

  // ── Cargar historial desde Supabase al montar ─────────────────────────────
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/provision/history");
        if (!res.ok) throw new Error("Error cargando historial");
        const rows: ProvisioningJobRow[] = await res.json();
        setJobs(rows.map(rowToJob));
      } catch (e) {
        console.warn("[ProvisioningView] historial:", e);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  const isFormValid =
    form.name.trim() &&
    form.shortName.trim() &&
    form.templateId &&
    form.provider.trim() &&
    form.routerHost.trim() &&
    form.routerUser.trim() &&
    form.routerPass.trim();

  // ── Deploy real via API ───────────────────────────────────────────────────
  const handleDeploy = async () => {
    if (!isFormValid || !selectedTpl || runningRef.current) return;
    runningRef.current = true;
    setDeploying(true);
    setDeployError(null);

    // Job "running" local para feedback inmediato
    const localJob: ProvisioningJob = {
      id:        `local-${Date.now()}`,
      siteId:    `site-${form.shortName.toLowerCase()}`,
      siteName:  form.name,
      templateId: form.templateId,
      hardware:  form.hardware,
      status:    "running",
      startedAt: new Date().toISOString(),
      steps:     buildSteps(form.templateId, form.name).map(s => ({ ...s, status: "pending" as const })),
    };

    setActiveJob(localJob);
    setJobs(prev => [localJob, ...prev]);
    setTab("historial");
    setExpandedJob(localJob.id);

    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId:       `site-${form.shortName.toLowerCase()}`,
          siteName:     form.name,
          shortName:    form.shortName,
          siteType:     form.type,
          lat:          form.coords.lat,
          lng:          form.coords.lng,
          provider:     form.provider,
          wanType:      form.wanType,
          bandwidthMbps: form.bandwidthMbps,
          host:         form.routerHost,
          port:         form.routerPort,
          protocol:     form.routerProtocol,
          username:     form.routerUser,
          password:     form.routerPass,
          tlsRejectUnauthorized: false,
          templateId:   form.templateId,
          hardware:     form.hardware,
        }),
      });

      let data: { success?: boolean; error?: string; job?: ProvisioningJobRow };
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `La API no está disponible (HTTP ${res.status}). ` +
          `Verificá que las edge functions estén desplegadas en Cloudflare Pages ` +
          `y que el build command sea "npm run build:cf".`
        );
      }
      data = await res.json() as { success?: boolean; error?: string; job?: ProvisioningJobRow };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Error en provisioning");
      }

      // Reemplazar job local con el real de Supabase
      const realJob = data.job ? rowToJob(data.job) : { ...localJob, status: "success" as const, completedAt: new Date().toISOString() };
      setJobs(prev => prev.map(j => j.id === localJob.id ? realJob : j));
      setActiveJob(realJob);
      setExpandedJob(realJob.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setDeployError(message);
      const failed = { ...localJob, status: "error" as const, completedAt: new Date().toISOString() };
      setJobs(prev => prev.map(j => j.id === localJob.id ? failed : j));
      setActiveJob(failed);
    } finally {
      setDeploying(false);
      runningRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#000814" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b scan-in"
        style={{ borderColor: "rgba(79,70,229,0.2)", background: "rgba(0,4,14,0.92)" }}>
        <div className="flex items-center gap-3">
          <Zap size={16} style={{ color: "#4F46E5" }} />
          <span className="data-value text-base font-semibold tracking-widest" style={{ color: "#a5b4fc" }}>
            PROVISIONING VELOZ
          </span>
          <span className="data-value text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>
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
      <div className="flex-shrink-0 flex border-b" style={{ borderColor: "rgba(79,70,229,0.15)" }}>
        {(["nuevo", "historial"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="data-value text-xs tracking-widest uppercase px-6 py-3 transition-colors"
            style={{
              color:        tab === t ? "#a5b4fc" : "rgba(148,163,184,0.7)",
              borderBottom: tab === t ? "2px solid #4F46E5" : "2px solid transparent",
              background:   tab === t ? "rgba(79,70,229,0.07)" : "transparent",
            }}>
            {t === "nuevo" ? "➕ Nuevo Sitio / Equipo" : `📋 Historial (${jobs.length})`}
          </button>
        ))}
      </div>

      {/* ── NUEVO SITIO ─────────────────────────────────────────────────── */}
      {tab === "nuevo" && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left: form */}
          <div className="w-[460px] flex-shrink-0 flex flex-col border-r overflow-y-auto"
            style={{ borderColor: "rgba(79,70,229,0.15)" }}>

            <div className="p-5 space-y-5">
              <SectionLabel icon={<MapPin size={12}/>} label="Datos del Sitio" />

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
                <div className="grid grid-cols-4 gap-2">
                  {SITE_TYPES.map(st => (
                    <button key={st.value} onClick={() => setForm(p => ({...p, type: st.value}))}
                      className="data-value text-xs py-2 rounded text-center transition-all"
                      style={{
                        border:     `1px solid ${form.type === st.value ? "rgba(79,70,229,0.6)" : "rgba(255,255,255,0.1)"}`,
                        background: form.type === st.value ? "rgba(79,70,229,0.18)" : "rgba(255,255,255,0.03)",
                        color:      form.type === st.value ? "#a5b4fc" : "rgba(148,163,184,0.8)",
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

              <SectionLabel icon={<Wifi size={12}/>} label="Conectividad WAN" />

              {/* WAN type */}
              <Field label="TIPO DE ENLACE">
                <div className="grid grid-cols-3 gap-2">
                  {WAN_TYPES.map(wt => {
                    const Icon = wt.icon;
                    const active = form.wanType === wt.value;
                    const c = LINK_TYPE_COLOR[wt.value];
                    return (
                      <button key={wt.value} onClick={() => setForm(p => ({...p, wanType: wt.value as typeof p.wanType}))}
                        className="flex items-center justify-center gap-2 data-value text-xs py-2.5 rounded transition-all"
                        style={{
                          border:     `1px solid ${active ? c + "70" : "rgba(255,255,255,0.1)"}`,
                          background: active ? `${c}18` : "rgba(255,255,255,0.03)",
                          color:      active ? c : "rgba(148,163,184,0.8)",
                        }}>
                        <Icon size={12}/>{wt.label}
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

              <SectionLabel icon={<Cpu size={12}/>} label="Equipo" />

              <Field label="MODELO MIKROTIK">
                <select value={form.hardware}
                  onChange={e => setForm(p => ({...p, hardware: e.target.value as HardwareModel}))}
                  className="hud-input w-full">
                  {HARDWARE_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>

              <SectionLabel icon={<Server size={12}/>} label="Acceso RouterOS API" />

              <Field label="HOST / DDNS DEL ROUTER">
                <input value={form.routerHost}
                  onChange={e => setForm(p => ({...p, routerHost: e.target.value}))}
                  placeholder="192.168.1.1 o xxxxxx.sn.mynetname.net"
                  className="hud-input w-full" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="PROTOCOLO">
                  <select value={form.routerProtocol}
                    onChange={e => setForm(p => ({...p, routerProtocol: e.target.value as "http" | "https"}))}
                    className="hud-input w-full">
                    <option value="http">HTTP (puerto 80)</option>
                    <option value="https">HTTPS (puerto 443)</option>
                  </select>
                </Field>
                <Field label="PUERTO">
                  <input type="number" value={form.routerPort}
                    onChange={e => setForm(p => ({...p, routerPort: parseInt(e.target.value) || 80}))}
                    className="hud-input w-full" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="USUARIO ROUTEROS">
                  <input value={form.routerUser}
                    onChange={e => setForm(p => ({...p, routerUser: e.target.value}))}
                    placeholder="admin"
                    className="hud-input w-full" />
                </Field>
                <Field label="CONTRASEÑA">
                  <input type="password" value={form.routerPass}
                    onChange={e => setForm(p => ({...p, routerPass: e.target.value}))}
                    className="hud-input w-full" />
                </Field>
              </div>
            </div>
          </div>

          {/* Right: templates + deploy */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Templates */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <SectionLabel icon={<Server size={12}/>} label="Plantilla Maestra RouterOS" />
              <p className="text-sm" style={{ color: "rgba(148,163,184,0.75)" }}>
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
                      border:     `1px solid ${isSelected ? "rgba(79,70,229,0.55)" : "rgba(79,70,229,0.18)"}`,
                      background: isSelected ? "rgba(79,70,229,0.1)" : "rgba(0,6,20,0.55)",
                      boxShadow:  isSelected ? "0 0 20px rgba(79,70,229,0.1)" : "none",
                    }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: "#4F46E5", boxShadow: "0 0 6px #4F46E5" }} />}
                        <span className="data-value text-sm font-semibold"
                          style={{ color: isSelected ? "#a5b4fc" : "rgba(226,232,240,0.9)" }}>
                          {tpl.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Clock size={11} style={{ color: "rgba(148,163,184,0.6)" }} />
                        <span className="data-value text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                          ~{tpl.estimatedSeconds}s
                        </span>
                      </div>
                    </div>

                    <p className="text-xs mb-3" style={{ color: "rgba(148,163,184,0.75)" }}>
                      {tpl.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tpl.features.map(f => (
                        <span key={f} className="data-value text-[11px] px-2 py-0.5 rounded"
                          style={{ color: "#a5b4fc", background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.25)" }}>
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <span className="data-value text-[11px] px-2 py-0.5 rounded"
                        style={{ color: lc, background: `${lc}14`, border: `1px solid ${lc}30` }}>
                        WAN: {tpl.wanType.toUpperCase()}
                      </span>
                      <span className="data-value text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                        HW: {tpl.hardware.join(", ")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Deploy button */}
            <div className="flex-shrink-0 p-5 border-t" style={{ borderColor: "rgba(79,70,229,0.15)" }}>
              {!isFormValid && (
                <p className="text-xs mb-3 text-center" style={{ color: "rgba(148,163,184,0.65)" }}>
                  Completá todos los campos incluyendo el host y credenciales del router.
                </p>
              )}
              {deployError && (
                <p className="text-xs mb-3 text-center px-3 py-2 rounded"
                  style={{ color: "#fb7185", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)" }}>
                  ✗ {deployError}
                </p>
              )}
              <button
                onClick={handleDeploy}
                disabled={!isFormValid || deploying}
                className="w-full py-3.5 rounded-lg data-value text-sm font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all"
                style={{
                  background:  isFormValid && !deploying ? "rgba(79,70,229,0.18)" : "rgba(255,255,255,0.03)",
                  border:      `1px solid ${isFormValid && !deploying ? "rgba(79,70,229,0.6)" : "rgba(255,255,255,0.08)"}`,
                  color:       isFormValid && !deploying ? "#a5b4fc" : "rgba(100,116,139,0.5)",
                  cursor:      isFormValid && !deploying ? "pointer" : "not-allowed",
                  boxShadow:   isFormValid && !deploying ? "0 0 24px rgba(79,70,229,0.15)" : "none",
                }}>
                {deploying
                  ? <><Loader2 size={15} className="animate-spin" /> Conectando con RouterOS…</>
                  : <><Zap size={15} /> Iniciar Provisioning</>
                }
              </button>
              {selectedTpl && !deploying && (
                <p className="text-xs mt-2 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>
                  Validará conexión al router · Guardará en Supabase · ~{selectedTpl.estimatedSeconds}s
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ───────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {deployError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)" }}>
              <XCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#F43F5E" }} />
              <div>
                <p className="data-value text-xs font-semibold tracking-widest mb-1" style={{ color: "#F43F5E" }}>
                  ERROR DE PROVISIONING
                </p>
                <p className="text-xs" style={{ color: "rgba(248,113,133,0.9)" }}>{deployError}</p>
              </div>
            </div>
          )}
          {historyLoading && (
            <div className="flex items-center justify-center h-24 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: "#4F46E5" }} />
              <span className="text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
                Cargando historial desde Supabase…
              </span>
            </div>
          )}
          {!historyLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Zap size={28} style={{ color: "#4F46E5", opacity: 0.3 }} />
              <span className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
                No hay provisionings en Supabase todavía
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
                style={{ border: `1px solid ${sc}28`, background: "rgba(0,6,20,0.65)" }}>

                {/* Job header */}
                <button
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  style={{ background: `${sc}08` }}>
                  <div className="flex items-center gap-3">
                    {isRunning
                      ? <Loader2 size={15} className="animate-spin" style={{ color: sc }} />
                      : job.status === "success"
                        ? <CheckCircle2 size={15} style={{ color: sc }} />
                        : <XCircle size={15} style={{ color: sc }} />
                    }
                    <div>
                      <span className="data-value text-sm font-semibold"
                        style={{ color: "rgba(226,232,240,0.95)" }}>
                        {job.siteName}
                      </span>
                      <span className="text-xs ml-2" style={{ color: "rgba(148,163,184,0.65)" }}>
                        {PROVISIONING_TEMPLATES.find(t => t.id === job.templateId)?.name ?? job.templateId}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="data-value text-xs font-semibold" style={{ color: sc }}>
                      {job.status.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>
                      {new Date(job.startedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span style={{ color: "rgba(148,163,184,0.55)" }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>
                </button>

                {/* Steps terminal */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Terminal size={11} style={{ color: "rgba(79,70,229,0.7)" }} />
                      <span className="data-value text-xs tracking-widest"
                        style={{ color: "rgba(148,163,184,0.6)" }}>
                        RouterOS · {job.hardware}
                      </span>
                    </div>

                    <div className="space-y-1.5 font-mono text-xs">
                      {liveJob.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5 w-3.5">
                            {step.status === "success" ? <CheckCircle2 size={11} style={{ color: "#10B981" }} />
                             : step.status === "running" ? <Loader2 size={11} className="animate-spin" style={{ color: "#4F46E5" }} />
                             : step.status === "error"   ? <XCircle size={11} style={{ color: "#F43F5E" }} />
                             : <span style={{ color: "rgba(100,116,139,0.5)" }}>·</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span style={{ color: step.status === "pending" ? "rgba(100,116,139,0.6)" : "rgba(203,213,225,0.9)" }}>
                              {step.label}
                            </span>
                            {step.status !== "pending" && (
                              <span className="ml-2 text-[11px]"
                                style={{ color: "rgba(100,116,139,0.65)" }}>
                                › <span style={{ color: "rgba(129,140,248,0.75)" }}>{step.command}</span>
                              </span>
                            )}
                            {step.log && (
                              <span className="ml-2 text-[11px]" style={{ color: "#10B981" }}>
                                ✓ {step.log}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {liveJob.status === "success" && liveJob.completedAt && (
                      <div className="mt-4 pt-3 border-t flex items-center gap-2"
                        style={{ borderColor: "rgba(16,185,129,0.2)" }}>
                        <CheckCircle2 size={12} style={{ color: "#10B981" }} />
                        <span className="text-xs" style={{ color: "#10B981" }}>
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
      <div className="data-value text-2xl font-bold tabular-nums leading-tight"
        style={{ color, textShadow: `0 0 12px ${color}55` }}>{value}</div>
      <div className="data-value text-[11px] tracking-widest mt-0.5" style={{ color: "rgba(148,163,184,0.65)" }}>{label}</div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span style={{ color: "rgba(99,102,241,0.85)" }}>{icon}</span>
      <span className="data-value text-xs tracking-widest uppercase font-semibold"
        style={{ color: "rgba(129,140,248,0.9)" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(79,70,229,0.2)" }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="data-value text-[11px] tracking-widest uppercase block font-medium"
        style={{ color: "rgba(148,163,184,0.8)" }}>{label}</label>
      {children}
    </div>
  );
}
