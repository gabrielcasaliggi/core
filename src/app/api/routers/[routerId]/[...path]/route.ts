/**
 * Proxy multi-router genérico: reenvía requests GET a la RouterOS REST API
 * del router identificado por `routerId`.
 *
 * Configuración en .env.local (reemplazar NOMBRE por el ID del router):
 *   ROUTER_NOMBRE_HOST=192.168.1.1
 *   ROUTER_NOMBRE_PROTOCOL=http          # http | https
 *   ROUTER_NOMBRE_PORT=80
 *   ROUTER_NOMBRE_USER=vertia-api
 *   ROUTER_NOMBRE_PASS=secreto
 *   ROUTER_NOMBRE_TLS_REJECT_UNAUTHORIZED=false   # solo para https con cert auto-firmado
 *
 * Ejemplo de llamada:
 *   GET /api/routers/hq/system/identity
 *        → lee ROUTER_HQ_* del entorno
 *        → https://<ROUTER_HQ_HOST>/rest/system/identity
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = Promise<{ routerId: string; path: string[] }>;

interface RouterConfig {
  host: string; user: string; pass: string;
  protocol: string; port: string; rejectTls: boolean;
}

async function getRouterConfig(id: string): Promise<RouterConfig | null> {
  // 1️⃣  Intentar variables de entorno primero (ROUTER_<ID>_*)
  const prefix   = `ROUTER_${id.toUpperCase()}_`;
  const envHost  = process.env[`${prefix}HOST`];
  const envUser  = process.env[`${prefix}USER`];
  const envPass  = process.env[`${prefix}PASS`];

  if (envHost && envUser && envPass) {
    const protocol = process.env[`${prefix}PROTOCOL`] ?? "https";
    return {
      host: envHost, user: envUser, pass: envPass,
      protocol,
      port:      process.env[`${prefix}PORT`] ?? (protocol === "http" ? "80" : "443"),
      rejectTls: process.env[`${prefix}TLS_REJECT_UNAUTHORIZED`] !== "false",
    };
  }

  // 2️⃣  Fallback: leer credenciales de Supabase por site_id
  //     El routerId puede ser "site-hq" o simplemente "hq" → normalizamos
  const siteId = id.startsWith("site-") ? id : `site-${id}`;
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();
    const { data } = await db
      .from("routers")
      .select("host, port, protocol, username, password, tls_reject_unauthorized")
      .eq("site_id", siteId)
      .eq("enabled", true)
      .single();

    if (!data) return null;
    return {
      host:     data.host,
      user:     data.username,
      pass:     data.password,
      protocol: data.protocol,
      port:     String(data.port),
      rejectTls: data.tls_reject_unauthorized,
    };
  } catch {
    return null;
  }
}

async function routerFetch(
  url: string,
  auth: string,
  protocol: string,
  rejectTls: boolean,
): Promise<Response> {
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  if (protocol === "http" || rejectTls) {
    return fetch(url, { headers, cache: "no-store" });
  }

  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, { headers, cache: "no-store" });
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { routerId, path } = await params;
  const cfg = await getRouterConfig(routerId);

  if (!cfg) {
    return NextResponse.json(
      {
        error:
          `Router "${routerId}" no encontrado. ` +
          `Registrarlo via Provisioning o agregar ROUTER_${routerId.toUpperCase()}_* en .env.local`,
      },
      { status: 503 },
    );
  }

  const routerPath = path.join("/");
  const query = request.nextUrl.searchParams.toString();
  const url = `${cfg.protocol}://${cfg.host}:${cfg.port}/rest/${routerPath}${query ? `?${query}` : ""}`;
  const auth = Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");

  try {
    const res = await routerFetch(url, auth, cfg.protocol, cfg.rejectTls);

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `RouterOS ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sin respuesta";
    console.error(`[Router proxy: ${routerId}] ${url} →`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
