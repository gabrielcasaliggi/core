/**
 * Proxy genérico: reenvía cualquier request GET a la RouterOS REST API v7.
 * Compatible con Cloudflare Pages (Edge Runtime).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HOST      = process.env.MIKROTIK_OFFICE_HOST;
const USER      = process.env.MIKROTIK_OFFICE_USER;
const PASS      = process.env.MIKROTIK_OFFICE_PASS;
const PROTOCOL  = process.env.MIKROTIK_OFFICE_PROTOCOL ?? "http";
const PORT      = process.env.MIKROTIK_OFFICE_PORT ?? "80";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!HOST || !USER || !PASS) {
    return NextResponse.json(
      { error: "Credenciales MikroTik no configuradas en variables de entorno." },
      { status: 503 },
    );
  }

  const { path } = await params;
  const routerPath = path.join("/");
  const query = request.nextUrl.searchParams.toString();
  const url = `${PROTOCOL}://${HOST}:${PORT}/rest/${routerPath}${query ? `?${query}` : ""}`;

  const auth = btoa(`${USER}:${PASS}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `RouterOS respondió ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sin respuesta del router";
    console.error(`[MikroTik proxy] ${url} →`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
