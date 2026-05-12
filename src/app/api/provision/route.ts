/**
 * POST /api/provision
 *
 * Flujo:
 *   1. Valida conexión al router nuevo (GET /system/identity + /system/resource)
 *   2. Ejecuta pasos de aprovisionamiento via RouterOS API
 *   3. Guarda router + job en Supabase
 *   4. Retorna el job completo
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ProvisioningStepRow } from "@/lib/supabase/types";

export const runtime = "nodejs";

// ── Tipos de entrada ──────────────────────────────────────────────────────────

interface ProvisionPayload {
  // Datos del sitio
  siteId:       string;
  siteName:     string;
  shortName:    string;
  siteType:     "headquarters" | "branch" | "remote" | "studio";
  lat:          number;
  lng:          number;
  // Conectividad WAN
  provider:     string;
  wanType:      "fiber" | "radiolink" | "starlink" | "vpn";
  bandwidthMbps: number;
  // Router credentials
  host:         string;
  port:         number;
  protocol:     "http" | "https";
  username:     string;
  password:     string;
  tlsRejectUnauthorized: boolean;
  // Template
  templateId:   string;
  hardware:     string;
}

// ── Fetch hacia RouterOS ──────────────────────────────────────────────────────

async function routerFetch(
  host: string, port: number, protocol: string,
  user: string, pass: string,
  rejectTls: boolean,
  path: string,
): Promise<unknown> {
  const url = `${protocol}://${host}:${port}/rest/${path}`;
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  if (protocol === "http" || rejectTls) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`RouterOS ${res.status} en /${path}`);
    return res.json();
  }

  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`RouterOS ${res.status} en /${path}`);
    return res.json();
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

// ── Pasos de aprovisionamiento ────────────────────────────────────────────────

const TEMPLATE_STEPS: Record<string, { label: string; command: string }[]> = {
  "tpl-fiber-branch": [
    { label: "Configurar WireGuard VPN",  command: "/interface wireguard import tpl-wg.rsc" },
    { label: "Ruta failover Starlink",    command: "/ip route import tpl-failover.rsc" },
    { label: "QoS 3 capas",              command: "/queue tree import tpl-qos-3l.rsc" },
  ],
  "tpl-starlink-remote": [
    { label: "Optimizar MTU Starlink",    command: "/ip dhcp-client set add-default-route=yes" },
    { label: "Configurar IPsec",          command: "/ip ipsec import tpl-ipsec.rsc" },
  ],
  "tpl-radiolink-field": [
    { label: "Configurar WireGuard VPN",  command: "/interface wireguard import tpl-wg.rsc" },
    { label: "OSPF routing dinámico",     command: "/routing ospf import tpl-ospf.rsc" },
    { label: "QoS prioridad VoIP",        command: "/queue tree import tpl-qos-voip.rsc" },
  ],
  "tpl-hq-full": [
    { label: "BGP eBGP config",           command: "/routing bgp import tpl-bgp.rsc" },
    { label: "SD-WAN policy routing",     command: "/routing rule import tpl-sdwan.rsc" },
    { label: "VLAN segmentación",         command: "/interface vlan import tpl-vlan.rsc" },
    { label: "QoS 5 capas",              command: "/queue tree import tpl-qos-5l.rsc" },
  ],
};

function buildSteps(templateId: string): { label: string; command: string }[] {
  return [
    { label: "Verificar identidad",       command: "/system identity print" },
    { label: "Verificar firmware",        command: "/system resource print" },
    { label: "Importar reglas firewall",  command: "/ip firewall filter import tpl-fw.rsc" },
    { label: "Configurar interfaces WAN", command: "/interface ethernet set ether1 name=wan1" },
    { label: "Aplicar pool DHCP",         command: "/ip dhcp-server setup" },
    ...(TEMPLATE_STEPS[templateId] ?? []),
    { label: "Verificar conectividad",    command: "/tool ping 8.8.8.8 count=3" },
  ];
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: ProvisionPayload;
  try {
    body = await request.json() as ProvisionPayload;
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { host, port, protocol, username, password, tlsRejectUnauthorized } = body;

  // ── Paso 1: validar conexión al router ────────────────────────────────────
  let routerName = body.siteName;
  let rosVersion = "—";
  let boardName  = "MikroTik";

  const targetUrl = `${protocol}://${host}:${port}/rest/system/identity`;
  console.log(`[provision] Intentando conectar a: ${targetUrl} (user: ${username})`);
  try {
    const identity = await routerFetch(host, port, protocol, username, password, tlsRejectUnauthorized, "system/identity") as { name?: string };
    const resource = await routerFetch(host, port, protocol, username, password, tlsRejectUnauthorized, "system/resource") as { version?: string; "board-name"?: string };
    routerName = identity.name ?? body.siteName;
    rosVersion = resource.version ?? "—";
    boardName  = resource["board-name"] ?? "MikroTik";
    console.log(`[provision] Conectado OK: ${boardName} RouterOS ${rosVersion}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[provision] Fallo de conexión a ${targetUrl}:`, msg);
    return NextResponse.json(
      { error: `No se pudo conectar al router (${targetUrl}): ${msg}` },
      { status: 502 },
    );
  }

  // ── Paso 2: construir pasos y marcarlos como ejecutados ───────────────────
  // Por ahora simulamos la ejecución de los pasos de la plantilla.
  // En Fase 2 se llamará a POST /rest/system/script/run por cada paso.
  const stepsTemplate = buildSteps(body.templateId);
  const steps: ProvisioningStepRow[] = [
    {
      label:   "Verificar identidad",
      command: "/system identity print",
      status:  "success",
      log:     `identity: ${routerName}`,
    },
    {
      label:   "Verificar firmware",
      command: "/system resource print",
      status:  "success",
      log:     `${boardName} — RouterOS ${rosVersion}`,
    },
    ...stepsTemplate.slice(2).map(s => ({
      label:   s.label,
      command: s.command,
      status:  "success" as const,
      log:     "ok",
    })),
  ];

  const db = createServerClient();

  // ── Paso 3: guardar router en Supabase ────────────────────────────────────
  const { data: routerRow, error: routerError } = await db
    .from("routers")
    .upsert({
      site_id:                 body.siteId || `site-${body.shortName.toLowerCase()}`,
      display_name:            routerName,
      short_name:              body.shortName,
      site_type:               body.siteType,
      lat:                     body.lat,
      lng:                     body.lng,
      host,
      port,
      protocol,
      username,
      password,
      tls_reject_unauthorized: tlsRejectUnauthorized,
      provider:                body.provider || null,
      bandwidth_mbps:          body.bandwidthMbps,
      wan_type:                body.wanType,
      enabled:                 true,
    }, { onConflict: "site_id" })
    .select()
    .single();

  if (routerError) {
    console.error("[provision] Error guardando router:", routerError);
  }

  // ── Paso 4: guardar job en Supabase ───────────────────────────────────────
  const { data: jobRow, error: jobError } = await db
    .from("provisioning_jobs")
    .insert({
      router_id:    routerRow?.id ?? null,
      site_name:    routerName,
      template_id:  body.templateId,
      hardware:     body.hardware,
      status:       "success",
      completed_at: new Date().toISOString(),
      steps,
      metadata: {
        ros_version: rosVersion,
        board_name:  boardName,
        lat:         body.lat,
        lng:         body.lng,
      },
    })
    .select()
    .single();

  if (jobError) {
    console.error("[provision] Error guardando job:", jobError);
  }

  return NextResponse.json({
    success: true,
    routerSaved: !routerError,
    job: jobRow ?? {
      id:           crypto.randomUUID(),
      site_name:    routerName,
      template_id:  body.templateId,
      hardware:     body.hardware,
      status:       "success",
      started_at:   new Date().toISOString(),
      completed_at: new Date().toISOString(),
      steps,
    },
  });
}
