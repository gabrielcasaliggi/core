/**
 * GET /api/routers/[routerId]/snapshot
 *
 * Obtiene todos los datos del router en UNA sola función edge,
 * evitando el límite de conexiones concurrentes de RouterOS REST API.
 * Retorna: identity, resource, interfaces, ip_addresses, routes
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type Params = Promise<{ routerId: string }>;

interface RouterConfig {
  host: string; user: string; pass: string;
  protocol: string; port: string;
}

async function getRouterConfig(id: string): Promise<RouterConfig | null> {
  const prefix  = `ROUTER_${id.toUpperCase()}_`;
  const envHost = process.env[`${prefix}HOST`];
  const envUser = process.env[`${prefix}USER`];
  const envPass = process.env[`${prefix}PASS`];

  if (envHost && envUser && envPass) {
    const protocol = process.env[`${prefix}PROTOCOL`] ?? "http";
    return {
      host: envHost, user: envUser, pass: envPass,
      protocol,
      port: process.env[`${prefix}PORT`] ?? (protocol === "http" ? "80" : "443"),
    };
  }

  const siteId = id.startsWith("site-") ? id : `site-${id}`;
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();
    type RouterCreds = { host: string; port: number; protocol: string; username: string; password: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("routers")
      .select("host, port, protocol, username, password")
      .eq("site_id", siteId)
      .eq("enabled", true)
      .single() as { data: RouterCreds | null };

    if (!data) return null;
    return { host: data.host, user: data.username, pass: data.password, protocol: data.protocol, port: String(data.port) };
  } catch {
    return null;
  }
}

async function rosGet(base: string, path: string, auth: string): Promise<unknown> {
  try {
    const res = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const { routerId } = await params;
  const cfg = await getRouterConfig(routerId);

  if (!cfg) {
    return NextResponse.json(
      { error: `Router "${routerId}" no encontrado.` },
      { status: 503 },
    );
  }

  const base = `${cfg.protocol}://${cfg.host}:${cfg.port}/rest`;
  const auth = btoa(`${cfg.user}:${cfg.pass}`);

  // Fetch secuencial para no saturar el límite de conexiones de RouterOS REST API.
  // En algunos equipos MikroTik las llamadas concurrentes desde diferentes
  // orígenes fallan silenciosamente (devuelven [] en vez de error).
  const identity    = await rosGet(base, "system/identity", auth);
  const resource    = await rosGet(base, "system/resource", auth);
  const interfaces  = await rosGet(base, "interface",       auth);
  const ip_addresses = await rosGet(base, "ip/address",     auth);
  const ip_routes   = await rosGet(base, "ip/route",        auth);

  return NextResponse.json({
    identity,
    resource,
    interfaces,
    ip_addresses,
    ip_routes,
  });
}
