/**
 * GET /api/debug-router?siteId=site-ofi
 * Endpoint temporal de diagnóstico — muestra interfaces e IPs crudas del router.
 * ELIMINAR después de resolver el problema de detección WAN.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "Falta parámetro ?siteId=..." }, { status: 400 });
  }

  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: router } = await (db as any)
      .from("routers")
      .select("host, port, protocol, username, password, site_id")
      .eq("site_id", siteId)
      .single();

    if (!router) return NextResponse.json({ error: `Router '${siteId}' no encontrado en Supabase` }, { status: 404 });

    const { host, port, protocol, username, password } = router;
    const base = `${protocol}://${host}:${port}/rest`;
    const auth = btoa(`${username}:${password}`);
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

    const [ifaces, addresses] = await Promise.all([
      fetch(`${base}/interface`, { headers, cache: "no-store" }).then(r => r.json()),
      fetch(`${base}/ip/address`,  { headers, cache: "no-store" }).then(r => r.json()),
    ]);

    return NextResponse.json({
      router: { host, port, protocol, site_id: router.site_id },
      interfaces: ifaces,
      ip_addresses: addresses,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
