/**
 * Clientes Supabase para VertiCore.
 *
 * - browserClient: para componentes React ("use client")
 * - createServerClient: para API routes (Next.js server)
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Cliente para uso en componentes del navegador. */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON);

/**
 * Cliente para uso en API routes (servidor).
 * Si existe SUPABASE_SERVICE_ROLE_KEY la usa (bypasea RLS).
 * Fallback: anon key (requiere políticas RLS permisivas).
 */
export function createServerClient() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnon;

  return createClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false },
  });
}
