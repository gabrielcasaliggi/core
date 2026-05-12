import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/routers — devuelve todos los routers habilitados */
export async function GET() {
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from("routers")
      .select("id, site_id, display_name, short_name, site_type, lat, lng, provider, wan_type, bandwidth_mbps, enabled, created_at")
      .eq("enabled", true)
      .order("created_at");

    if (error) {
      console.error("[/api/routers] Supabase error:", error.code, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[/api/routers] Exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
