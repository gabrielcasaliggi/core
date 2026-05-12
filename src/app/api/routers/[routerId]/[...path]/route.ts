/**
 * Proxy multi-router: reenvía requests a RouterOS por routerId.
 * Busca credenciales en env vars primero, luego en Supabase.
 * Compatible con Cloudflare Pages (Edge Runtime).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type Params = Promise<{ routerId: string; path: string[] }>;

interface RouterConfig {
  host: string; user: string; pass: string;
  protocol: string; port: string;
}

async function getRouterConfig(id: string): Promise<RouterConfig | null> {
  // 1️⃣  Variables de entorno (ROUTER_<ID>_*)
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

  // 2️⃣  Fallback: Supabase
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
    return {
      host:     data.host,
      user:     data.username,
      pass:     data.password,
      protocol: data.protocol,
      port:     String(data.port),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { routerId, path } = await params;
  const cfg = await getRouterConfig(routerId);

  if (!cfg) {
    return NextResponse.json(
      { error: `Router "${routerId}" no encontrado. Registrarlo via Provisioning.` },
      { status: 503 },
    );
  }

  const routerPath = path.join("/");
  const query = request.nextUrl.searchParams.toString();
  const url = `${cfg.protocol}://${cfg.host}:${cfg.port}/rest/${routerPath}${query ? `?${query}` : ""}`;
  const auth = btoa(`${cfg.user}:${cfg.pass}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `RouterOS ${res.status}: ${text}`, url },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sin respuesta";
    console.error(`[Router proxy: ${routerId}] ${url} →`, message);
    return NextResponse.json({ error: message, url, host: cfg.host, port: cfg.port, protocol: cfg.protocol }, { status: 502 });
  }
}
