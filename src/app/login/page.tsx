"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Lock, Mail, Activity, ArrowRight, Shield } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const errParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    errParam === "auth" ? "No se pudo completar el acceso. Intentá de nuevo." : "",
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signErr } = await getSupabaseClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signErr) {
      setError(signErr.message);
      return;
    }
    router.replace(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{ background: "#000814" }}
    >
      {/* Capa de partículas / red — líneas que se mueven */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.svg
          className="absolute inset-0 h-full w-full opacity-[0.12]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#4F46E5" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </motion.svg>
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(79,70,229,0.04) 80px, rgba(79,70,229,0.04) 81px)",
          }}
          animate={{ x: [0, 80, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Orbes de luz */}
      {[
        { left: "8%", top: "10%", w: 320, delay: 0, duration: 11 },
        { right: "5%", top: "55%", w: 260, delay: 2, duration: 14 },
        { left: "35%", bottom: "5%", w: 200, delay: 1, duration: 9 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute rounded-full blur-[100px]"
          style={{
            ...(orb.left ? { left: orb.left } : { right: orb.right }),
            ...(orb.top !== undefined ? { top: orb.top } : {}),
            ...(orb.bottom !== undefined ? { bottom: orb.bottom } : {}),
            width: orb.w,
            height: orb.w,
            background:
              i === 0
                ? "radial-gradient(circle, rgba(79,70,229,0.55) 0%, transparent 70%)"
                : i === 1
                  ? "radial-gradient(circle, rgba(6,182,212,0.35) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(129,140,248,0.4) 0%, transparent 70%)",
          }}
          initial={{ opacity: 0.25, scale: 0.95 }}
          animate={{
            opacity: [0.2, 0.5, 0.25],
            scale: [0.95, 1.08, 0.95],
            x: i % 2 === 0 ? [0, 24, 0] : [0, -18, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      {/* Anillo de escaneo */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500/10"
        style={{ boxShadow: "0 0 120px rgba(79,70,229,0.08) inset" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      />

      {/* Card login */}
      <motion.div
        className="relative z-10 w-full max-w-[420px] px-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div
          className="rounded-2xl border px-8 py-10 backdrop-blur-md"
          style={{
            background: "rgba(0,6,20,0.75)",
            borderColor: "rgba(79,70,229,0.35)",
            boxShadow:
              "0 0 0 1px rgba(79,70,229,0.1), 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(79,70,229,0.15)",
          }}
        >
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <motion.div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                border: "1px solid rgba(79,70,229,0.4)",
                background: "rgba(79,70,229,0.12)",
              }}
              animate={{ boxShadow: ["0 0 20px rgba(79,70,229,0.2)", "0 0 32px rgba(79,70,229,0.35)", "0 0 20px rgba(79,70,229,0.2)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Activity className="text-indigo-400" size={20} />
              <span className="data-value text-sm font-bold tracking-[0.35em]" style={{ color: "#a5b4fc" }}>
                VERTIA
              </span>
              <span className="data-value text-sm tracking-widest" style={{ color: "rgba(129,140,248,0.6)" }}>
                CORE
              </span>
            </motion.div>
            <p className="data-value text-[11px] uppercase tracking-[0.28em]" style={{ color: "rgba(71,85,105,0.85)" }}>
              Mando de resiliencia · acceso restringido
            </p>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(16,185,129,0.85)" }}>
              <Shield size={12} />
              <span className="data-value tracking-wider">Canal cifrado activo</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                style={{ color: "rgba(100,116,139,0.9)" }}>
                <Mail size={10} /> Correo
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none transition-shadow"
                style={{
                  background: "rgba(0,8,22,0.85)",
                  borderColor: "rgba(79,70,229,0.25)",
                  color: "rgba(226,232,240,0.95)",
                }}
                placeholder="operador@vertia.net.ar"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                style={{ color: "rgba(100,116,139,0.9)" }}>
                <Lock size={10} /> Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none"
                style={{
                  background: "rgba(0,8,22,0.85)",
                  borderColor: "rgba(79,70,229,0.25)",
                  color: "rgba(226,232,240,0.95)",
                }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="data-value rounded-lg border px-3 py-2 text-center text-xs"
                style={{ borderColor: "rgba(244,63,94,0.35)", color: "#fb7185", background: "rgba(244,63,94,0.08)" }}>
                {error}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              className="data-value flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-xs font-semibold uppercase tracking-[0.2em] transition-opacity disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #6366f1 50%, #4338ca 100%)",
                color: "#fff",
                boxShadow: "0 0 28px rgba(79,70,229,0.45)",
              }}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? "Autenticando…" : (
                <>
                  Ingresar al mando
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>
        </div>

        <p className="data-value mt-6 text-center text-[9px] tracking-widest" style={{ color: "rgba(71,85,105,0.65)" }}>
          core.vertia.net.ar · uso autorizado únicamente
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center data-value text-xs tracking-[0.3em]"
          style={{ background: "#000814", color: "#6366f1" }}
        >
          INICIALIZANDO SESIÓN…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
