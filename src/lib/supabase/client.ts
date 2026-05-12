/**
 * Clientes Supabase para VertiCore.
 *
 * - browserClient: para componentes React ("use client")
 * - createServerClient: para API routes (Next.js server)
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente browser — inicialización lazy para no fallar durante el build
 * cuando las env vars aún no están inyectadas.
 */
let _browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_browserClient) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !anon) throw new Error("Supabase env vars not set");
    _browserClient = createClient(url, anon);
  }
  return _browserClient;
}

/** Alias para compatibilidad con código existente que importa `supabase`. */
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as never as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Cliente servidor — lee vars en runtime (no en build-time).
 * Usa service role key si existe, si no, anon key + RLS.
 */
export function createServerClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
