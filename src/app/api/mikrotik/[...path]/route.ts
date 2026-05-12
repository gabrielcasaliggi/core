/**
 * Proxy genérico: reenvía cualquier request GET a la RouterOS REST API v7.
 *
 * Ejemplo:
 *   GET /api/mikrotik/system/identity
 *        → https://<host>/rest/system/identity
 *
 * Solo corre en el servidor (Node.js runtime) para:
 *   1. Ocultar credenciales al cliente
 *   2. Evitar CORS
 *   3. Manejar certificados auto-firmados de MikroTik
 *
 * NOTA: Las rutas API de Next.js solo están disponibles en `npm run dev`
 * cuando el proyecto usa `output: "export"`. Para producción se necesita
 * cambiar a un despliegue con servidor (Vercel / VPS).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const HOST      = process.env.MIKROTIK_OFFICE_HOST;
const USER      = process.env.MIKROTIK_OFFICE_USER;
const PASS      = process.env.MIKROTIK_OFFICE_PASS;
const PROTOCOL  = process.env.MIKROTIK_OFFICE_PROTOCOL ?? "https";
const PORT      = process.env.MIKROTIK_OFFICE_PORT ?? (PROTOCOL === "http" ? "80" : "443");
const REJECT_TLS = process.env.MIKROTIK_OFFICE_TLS_REJECT_UNAUTHORIZED !== "false";

/** Fetch hacia el router. En HTTP no hay manejo de TLS. */
async function routerFetch(url: string): Promise<Response> {
  const headers = {
    Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`,
    Accept: "application/json",
  };

  // HTTP plano — sin lógica TLS
  if (PROTOCOL === "http") {
    return fetch(url, { headers, cache: "no-store" });
  }

  // HTTPS con certificado válido
  if (REJECT_TLS) {
    return fetch(url, { headers, cache: "no-store" });
  }

  // HTTPS con certificado auto-firmado: deshabilitar verificación solo
  // para esta petición y restaurar el valor anterior inmediatamente.
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, { headers, cache: "no-store" });
  } finally {
    if (prev === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!HOST || !USER || !PASS) {
    return NextResponse.json(
      {
        error:
          "Credenciales MikroTik no configuradas. " +
          "Completar .env.local con MIKROTIK_OFFICE_HOST / USER / PASS.",
      },
      { status: 503 },
    );
  }

  const { path } = await params;
  const routerPath = path.join("/");
  const query = request.nextUrl.searchParams.toString();
  const url = `${PROTOCOL}://${HOST}:${PORT}/rest/${routerPath}${query ? `?${query}` : ""}`;

  try {
    const res = await routerFetch(url);

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
