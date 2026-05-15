"use client";

import { Suspense, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  Lock,
  Mail,
  Activity,
  Shield,
  Globe2,
  Radio,
  Zap,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  { icon: Globe2, label: "SD-WAN", sub: "Enlaces en vivo" },
  { icon: Shield, label: "Ciberdefensa", sub: "Perímetro activo" },
  { icon: Radio, label: "Orquestación", sub: "MikroTik unificado" },
] as const;

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

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: 60, damping: 18 });
  const springY = useSpring(cursorY, { stiffness: 60, damping: 18 });

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
      className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto"
      style={{ background: "#000814" }}
      onMouseMove={e => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        cursorX.set(e.clientX - r.left);
        cursorY.set(e.clientY - r.top);
      }}
    >
      {/* Viñeta / profundidad */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 65% at 50% 45%, transparent 0%, rgba(0,8,20,0.85) 72%, #000814 100%)",
        }}
      />

      {/* Barra de barrido luminosa */}
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-[2] h-px origin-center"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.5), rgba(6,182,212,0.4), transparent)",
          boxShadow: "0 0 24px rgba(99,102,241,0.35)",
        }}
        initial={{ top: "8%", opacity: 0 }}
        animate={{ top: ["8%", "92%", "8%"], opacity: [0, 0.85, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", times: [0, 0.5, 1] }}
      />

      {/* Spot que sigue al cursor (sutil) */}
      <motion.div
        className="pointer-events-none fixed z-[1] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{
          left: springX,
          top: springY,
          background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 55%)",
        }}
      />

      {/* Red + rejilla animada */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <svg className="absolute h-full w-full opacity-[0.14]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-grid" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#6366f1" strokeWidth="0.45" />
            </pattern>
            <linearGradient id="line-fade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-grid)" />
          {[0, 1, 2].map(i => (
            <motion.line
              key={i}
              x1="-10%"
              y1={`${28 + i * 22}%`}
              x2="110%"
              y2={`${32 + i * 18}%`}
              stroke="url(#line-fade)"
              strokeWidth="0.8"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 4 + i * 1.1, repeat: Infinity, delay: i * 0.7, ease: "easeInOut" }}
            />
          ))}
        </svg>
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent, transparent 96px, rgba(79,70,229,0.035) 96px, rgba(79,70,229,0.035) 97px)",
          }}
          animate={{ x: [0, 96, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Orbes */}
      {[
        { left: "6%", top: "12%", w: 380, d: 12 },
        { right: "4%", top: "48%", w: 280, d: 15 },
        { left: "42%", bottom: "6%", w: 220, d: 10 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute z-0 rounded-full blur-[120px]"
          style={{
            ...(orb.left ? { left: orb.left } : { right: orb.right }),
            ...(orb.top !== undefined ? { top: orb.top } : {}),
            ...(orb.bottom !== undefined ? { bottom: orb.bottom } : {}),
            width: orb.w,
            height: orb.w,
            background:
              i === 0
                ? "radial-gradient(circle, rgba(79,70,229,0.45) 0%, transparent 68%)"
                : i === 1
                  ? "radial-gradient(circle, rgba(6,182,212,0.28) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(165,180,252,0.35) 0%, transparent 68%)",
          }}
          animate={{
            opacity: [0.18, 0.42, 0.2],
            scale: [0.92, 1.06, 0.92],
            x: i % 2 === 0 ? [0, 30, 0] : [0, -24, 0],
            y: [0, -28, 0],
          }}
          transition={{ duration: orb.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
        />
      ))}

      {/* Contenido */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-5 py-14 lg:flex-row lg:items-center lg:gap-16 lg:py-10">
        {/* Columna hero */}
        <motion.div
          className="flex-1 text-center lg:max-w-xl lg:text-left"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
            style={{
              borderColor: "rgba(79,70,229,0.35)",
              background: "rgba(79,70,229,0.08)",
              boxShadow: "0 0 40px rgba(79,70,229,0.12)",
            }}>
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: "#10B981", boxShadow: "0 0 10px #10B981" }}
            />
            <span className="data-value text-[10px] font-semibold tracking-[0.35em]" style={{ color: "#94a3b8" }}>
              SISTEMA OPERATIVO
            </span>
          </div>

          <h1 className="mb-4 font-semibold leading-[0.95] tracking-tight"
            style={{
              fontSize: "clamp(2.75rem, 8vw, 4.25rem)",
              background: "linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 35%, #6366f1 55%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 40px rgba(99,102,241,0.25))",
            }}>
            VERTIA CORE
          </h1>

          <p className="mb-2 data-value text-sm font-medium uppercase tracking-[0.32em]" style={{ color: "rgba(148,163,184,0.95)" }}>
            Orquestador de conectividad soberana
          </p>
          <p className="mb-10 max-w-md text-[13px] leading-relaxed lg:mx-0 mx-auto" style={{ color: "rgba(100,116,139,0.92)" }}>
            Acceso restringido al mando de resiliencia: telemetría de red, SD-WAN, provisionamiento y estado de infraestructura en tiempo real.
          </p>

          <ul className="mb-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
            {FEATURES.map(({ icon: Icon, label, sub }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left"
                style={{
                  borderColor: "rgba(79,70,229,0.2)",
                  background: "rgba(0,8,22,0.5)",
                }}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(79,70,229,0.15)",
                    border: "1px solid rgba(79,70,229,0.25)",
                    color: "#a5b4fc",
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </span>
                <div>
                  <div className="data-value text-[11px] font-bold tracking-widest" style={{ color: "#c7d2fe" }}>
                    {label}
                  </div>
                  <div className="data-value text-[9px] tracking-wider" style={{ color: "rgba(100,116,139,0.85)" }}>
                    {sub}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>

          {/* Línea tipo telemetría */}
          <div
            className="hidden rounded-lg border px-4 py-3 font-mono text-[10px] leading-relaxed tracking-wide sm:block"
            style={{
              borderColor: "rgba(6,182,212,0.2)",
              background: "rgba(6,182,212,0.04)",
              color: "rgba(71,85,105,0.9)",
            }}
          >
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="text-cyan-400/90"
            >
              ▸
            </motion.span>{" "}
            AUTH_CHALLENGE · TLS1.3 · REGION AR ·{" "}
            <span style={{ color: "rgba(129,140,248,0.85)" }}>SESSION_PENDING</span>
          </div>
        </motion.div>

        {/* Columna formulario */}
        <motion.div
          className="w-full flex-shrink-0 lg:w-[420px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
        >
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-70 blur-sm"
              style={{
                background:
                  "linear-gradient(125deg, rgba(79,70,229,0.35), transparent 45%, rgba(6,182,212,0.2))",
              }}
            />
            <div
              className="relative hud-corners rounded-2xl border px-8 py-9 backdrop-blur-xl sm:px-10 sm:py-10"
              style={{
                background: "linear-gradient(165deg, rgba(0,10,28,0.92) 0%, rgba(0,6,20,0.88) 100%)",
                borderColor: "rgba(79,70,229,0.38)",
                boxShadow:
                  "0 0 0 1px rgba(79,70,229,0.08), 0 28px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="mb-8 flex items-center justify-between gap-4 border-b pb-6"
                style={{ borderColor: "rgba(79,70,229,0.15)" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(79,70,229,0.18)",
                      border: "1px solid rgba(79,70,229,0.35)",
                      boxShadow: "0 0 20px rgba(79,70,229,0.2)",
                    }}
                  >
                    <Zap className="text-indigo-300" size={22} />
                  </div>
                  <div>
                    <div className="data-value text-[10px] font-bold tracking-[0.3em]" style={{ color: "#a5b4fc" }}>
                      ACCESO OPERADOR
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px]" style={{ color: "rgba(16,185,129,0.9)" }}>
                      <Shield size={11} />
                      <span className="data-value tracking-wider">Canal cifrado · Supabase Auth</span>
                    </div>
                  </div>
                </div>
                <Activity className="hidden text-indigo-500/50 sm:block" size={22} />
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                    style={{ color: "rgba(100,116,139,0.9)" }}
                  >
                    <Mail size={10} /> Identidad (correo)
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none ring-0 transition-[box-shadow,border-color] focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]"
                    style={{
                      background: "rgba(0,8,22,0.88)",
                      borderColor: "rgba(79,70,229,0.28)",
                      color: "rgba(226,232,240,0.96)",
                    }}
                    placeholder="operador@vertia.net.ar"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                    style={{ color: "rgba(100,116,139,0.9)" }}
                  >
                    <Lock size={10} /> Credencial
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none transition-[box-shadow,border-color] focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]"
                    style={{
                      background: "rgba(0,8,22,0.88)",
                      borderColor: "rgba(79,70,229,0.28)",
                      color: "rgba(226,232,240,0.96)",
                    }}
                    placeholder="Contraseña"
                  />
                </div>

                {error && (
                  <p
                    className="data-value rounded-lg border px-3 py-2.5 text-center text-xs"
                    style={{
                      borderColor: "rgba(244,63,94,0.4)",
                      color: "#fda4af",
                      background: "rgba(244,63,94,0.1)",
                    }}
                  >
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="group data-value relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg py-3.5 text-xs font-semibold uppercase tracking-[0.22em] transition-opacity disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5 0%, #6366f1 42%, #4338ca 100%)",
                    color: "#fff",
                    boxShadow: "0 0 32px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  <motion.span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                    }}
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                  />
                  {loading ? "Autenticando…" : (
                    <>
                      Ingresar al mando
                      <ChevronRight size={18} className="opacity-80" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </div>

          <p
            className="data-value mt-7 text-center text-[9px] tracking-[0.2em]"
            style={{ color: "rgba(71,85,105,0.65)" }}
          >
            core.vertia.net.ar · uso autorizado únicamente
          </p>
        </motion.div>
      </div>

      {/* Anillos decorativos inferiores */}
      <motion.div
        className="pointer-events-none absolute bottom-[-20%] left-1/2 z-[1] h-[min(80vw,520px)] w-[min(80vw,520px)] -translate-x-1/2 rounded-full border border-indigo-500/[0.07]"
        style={{ boxShadow: "inset 0 0 80px rgba(79,70,229,0.06)" }}
        animate={{ rotate: -360, scale: [1, 1.02, 1] }}
        transition={{ rotate: { duration: 140, repeat: Infinity, ease: "linear" }, scale: { duration: 8, repeat: Infinity } }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-3 data-value text-xs tracking-[0.35em]"
          style={{ background: "#000814", color: "#818cf8" }}
        >
          <motion.div
            className="h-1 w-24 overflow-hidden rounded-full"
            style={{ background: "rgba(79,70,229,0.25)" }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #22d3ee)" }}
              animate={{ x: ["0%", "200%", "0%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          INICIALIZANDO SESIÓN…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
