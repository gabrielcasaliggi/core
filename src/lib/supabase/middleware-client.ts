import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/**
 * Middleware Supabase: refresca sesión y protege rutas sensibles.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) {
    console.error("[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!isPublicPath(pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", pathname === "/" ? "/dashboard" : pathname);
      return NextResponse.redirect(redirect);
    }
  } else {
    if (pathname === "/login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/dashboard";
      redirect.searchParams.delete("next");
      return NextResponse.redirect(redirect);
    }
    if (pathname === "/") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/dashboard";
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}
