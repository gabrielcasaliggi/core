"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
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
  { icon: Globe2, label: "SD-WAN", sub: "Monitoreo de enlaces" },
  { icon: Shield, label: "Resiliencia", sub: "Estado unificado" },
  { icon: Radio, label: "Infraestructura", sub: "Integración RouterOS" },
] as const;

const TELEMETRY_LINES = [
  "SEC_GATEWAY · TLS 1.3 · EDGE · AWAIT_CREDENTIAL",
  "LINK_STABLE · AES_256_GCM · REGION AR · IDLE",
  "POLICY_ENFORCED · AUDIT_LOG · SESSION_HANDSHAKE",
] as const;

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Credenciales no válidas. Verificá correo y contraseña.";
  }
  if (m.includes("email not confirmed")) {
    return "Cuenta pendiente de verificación. Revisá tu bandeja de correo.";
  }
  if (m.includes("too many requests")) {
    return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "No se pudo contactar al servicio de identidad. Revisá tu conexión.";
  }
  return message;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const errParam = searchParams.get("error");

  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    errParam === "auth" ? "La sesión no pudo establecerse. Volvé a identificarte." : "",
  );
  const [loading, setLoading] = useState(false);
  const [telemetryIdx, setTelemetryIdx] = useState(0);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: prefersReducedMotion ? 200 : 60, damping: prefersReducedMotion ? 40 : 18 });
  const springY = useSpring(cursorY, { stiffness: prefersReducedMotion ? 200 : 60, damping: prefersReducedMotion ? 40 : 18 });

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setTelemetryIdx(i => (i + 1) % TELEMETRY_LINES.length);
    }, 4800);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  const telemetryLine = useMemo(() => TELEMETRY_LINES[telemetryIdx], [telemetryIdx]);

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
      setError(mapAuthError(signErr.message));
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
        if (prefersReducedMotion) return;
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        cursorX.set(e.clientX - r.left);
        cursorY.set(e.clientY - r.top);
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 88% 68% at 50% 42%, transparent 0%, rgba(0,8,20,0.88) 74%, #000814 100%)",
        }}
      />

      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-0 z-[2] h-px origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(129,140,248,0.45), rgba(6,182,212,0.35), transparent)",
            boxShadow: "0 0 24px rgba(99,102,241,0.3)",
          }}
          initial={{ top: "8%", opacity: 0 }}
          animate={{ top: ["8%", "92%", "8%"], opacity: [0, 0.75, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", times: [0, 0.5, 1] }}
        />
      )}

      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none fixed z-[1] h-[min(520px,90vw)] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{
            left: springX,
            top: springY,
            background: "radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 56%)",
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <svg className="absolute h-full w-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <pattern id="login-grid" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#6366f1" strokeWidth="0.4" />
            </pattern>
            <linearGradient id="line-fade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-grid)" />
          {!prefersReducedMotion &&
            [0, 1, 2].map(i => (
              <motion.line
                key={i}
                x1="-10%"
                y1={`${28 + i * 22}%`}
                x2="110%"
                y2={`${32 + i * 18}%`}
                stroke="url(#line-fade)"
                strokeWidth="0.7"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 4 + i * 1.1, repeat: Infinity, delay: i * 0.7, ease: "easeInOut" }}
              />
            ))}
        </svg>
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(90deg, transparent, transparent 96px, rgba(79,70,229,0.032) 96px, rgba(79,70,229,0.032) 97px)",
            }}
            animate={{ x: [0, 96, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {!prefersReducedMotion &&
        [
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
                  ? "radial-gradient(circle, rgba(79,70,229,0.38) 0%, transparent 68%)"
                  : i === 1
                    ? "radial-gradient(circle, rgba(6,182,212,0.24) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(165,180,252,0.3) 0%, transparent 68%)",
            }}
            animate={{
              opacity: [0.16, 0.38, 0.18],
              scale: [0.94, 1.04, 0.94],
              x: i % 2 === 0 ? [0, 28, 0] : [0, -22, 0],
              y: [0, -24, 0],
            }}
            transition={{ duration: orb.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
          />
        ))}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-5 py-14 lg:flex-row lg:items-center lg:gap-20 lg:py-12">
        <motion.div
          className="flex-1 text-center lg:max-w-xl lg:text-left"
          initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div
            className="mb-6 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5"
            style={{
              borderColor: "rgba(79,70,229,0.32)",
              background: "linear-gradient(180deg, rgba(79,70,229,0.12) 0%, rgba(0,8,22,0.4) 100%)",
              boxShadow: "0 0 32px rgba(79,70,229,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${prefersReducedMotion ? "" : "animate-pulse"}`}
              style={{
                background: "#10B981",
                boxShadow: "0 0 10px #10B981",
              }}
            />
            <span className="data-value text-[10px] font-semibold tracking-[0.28em]" style={{ color: "#94a3b8" }}>
              ENTORNO PRODUCTIVO
            </span>
          </div>

          <h1
            className="mb-4 font-semibold leading-[0.92] tracking-tight"
            style={{
              fontSize: "clamp(2.65rem, 7.5vw, 4.1rem)",
              background: "linear-gradient(145deg, #f1f5ff 0%, #c7d2fe 28%, #6366f1 52%, #0891b2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 36px rgba(99,102,241,0.22))",
            }}
          >
            VERTIA CORE
          </h1>

          <p
            className="mb-3 data-value text-[13px] font-medium uppercase tracking-[0.26em]"
            style={{ color: "rgba(148,163,184,0.95)" }}
          >
            Plataforma de orquestación de conectividad
          </p>
          <p
            className="mb-10 max-w-[28rem] text-[13px] leading-[1.65] lg:mx-0 mx-auto"
            style={{ color: "rgba(100,116,139,0.94)" }}
          >
            Portal restringido para operadores autorizados. Supervisión de red, enlaces WAN,
            aprovisionamiento y métricas de infraestructura en tiempo casi real.
          </p>

          <ul className="mb-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
            {FEATURES.map(({ icon: Icon, label, sub }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.08, duration: 0.35 }}
                className="flex min-w-[200px] flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left sm:max-w-[220px]"
                style={{
                  borderColor: "rgba(79,70,229,0.18)",
                  background: "linear-gradient(165deg, rgba(0,12,28,0.55) 0%, rgba(0,6,18,0.65) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(79,70,229,0.12)",
                    border: "1px solid rgba(79,70,229,0.22)",
                    color: "#a5b4fc",
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </span>
                <div>
                  <div className="data-value text-[11px] font-bold tracking-widest" style={{ color: "#e0e7ff" }}>
                    {label}
                  </div>
                  <div className="data-value text-[9px] tracking-wide" style={{ color: "rgba(100,116,139,0.88)" }}>
                    {sub}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>

          <div
            className="hidden overflow-hidden rounded-lg border font-mono text-[10px] leading-relaxed tracking-[0.06em] sm:block"
            style={{
              borderColor: "rgba(6,182,212,0.18)",
              background: "rgba(0,14,28,0.55)",
              color: "rgba(100,116,139,0.92)",
            }}
            role="status"
            aria-live="polite"
          >
            <div
              className="flex items-center gap-2 border-b px-3 py-2"
              style={{ borderColor: "rgba(6,182,212,0.1)", background: "rgba(6,182,212,0.04)" }}
            >
              <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(6,182,212,0.75)" }}>
                Canal de señalización
              </span>
            </div>
            <div className="px-4 py-3">
              <motion.span
                animate={prefersReducedMotion ? {} : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.2, repeat: prefersReducedMotion ? 0 : Infinity }}
                className="text-cyan-400/90"
              >
                ▸
              </motion.span>{" "}
              <motion.span
                key={telemetryLine}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                className="inline-block"
              >
                {telemetryLine}
              </motion.span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="w-full flex-shrink-0 lg:w-[432px]"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: "easeOut" }}
        >
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 blur-md"
              style={{
                background:
                  "linear-gradient(128deg, rgba(79,70,229,0.28), transparent 42%, rgba(6,182,212,0.14))",
              }}
            />
            <div
              className="relative hud-corners rounded-2xl border px-8 py-9 backdrop-blur-xl sm:px-10 sm:py-10"
              style={{
                background: "linear-gradient(168deg, rgba(0,12,30,0.94) 0%, rgba(0,5,18,0.9) 100%)",
                borderColor: "rgba(79,70,229,0.34)",
                boxShadow:
                  "0 0 0 1px rgba(79,70,229,0.06), 0 32px 100px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div
                className="mb-8 flex items-center justify-between gap-4 border-b pb-6"
                style={{ borderColor: "rgba(79,70,229,0.12)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(79,70,229,0.14)",
                      border: "1px solid rgba(79,70,229,0.32)",
                      boxShadow: "0 0 24px rgba(79,70,229,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
                    }}
                  >
                    <Zap className="text-indigo-300" size={22} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="data-value text-[10px] font-bold tracking-[0.28em]" style={{ color: "#c7d2fe" }}>
                      IDENTIFICACIÓN DE OPERADOR
                    </div>
                    <div
                      className="mt-1 flex items-center gap-1.5 text-[9px] leading-tight"
                      style={{ color: "rgba(16,185,129,0.88)" }}
                    >
                      <Shield size={11} strokeWidth={2} />
                      <span className="data-value tracking-wide">
                        Tráfico cifrado · Políticas corporativas aplicadas
                      </span>
                    </div>
                  </div>
                </div>
                <Activity className="hidden shrink-0 text-indigo-400/45 sm:block" size={22} strokeWidth={1.5} />
              </div>

              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                    style={{ color: "rgba(100,116,139,0.92)" }}
                    htmlFor="login-email"
                  >
                    <Mail size={10} strokeWidth={2} aria-hidden /> Correo corporativo
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none transition-[box-shadow,border-color] focus:border-indigo-400/45 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)]"
                    style={{
                      background: "rgba(0,10,26,0.92)",
                      borderColor: "rgba(79,70,229,0.26)",
                      color: "rgba(241,245,249,0.96)",
                    }}
                    placeholder="nombre@tu-organizacion.com"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 data-value text-[9px] uppercase tracking-widest"
                    style={{ color: "rgba(100,116,139,0.92)" }}
                    htmlFor="login-password"
                  >
                    <Lock size={10} strokeWidth={2} aria-hidden /> Clave de acceso
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="data-value w-full rounded-lg border px-4 py-3 text-sm outline-none transition-[box-shadow,border-color] focus:border-indigo-400/45 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)]"
                    style={{
                      background: "rgba(0,10,26,0.92)",
                      borderColor: "rgba(79,70,229,0.26)",
                      color: "rgba(241,245,249,0.96)",
                    }}
                    placeholder="············"
                  />
                </div>

                {error && (
                  <p
                    className="data-value rounded-lg border px-3 py-2.5 text-center text-[13px] leading-snug"
                    style={{
                      borderColor: "rgba(244,63,94,0.35)",
                      color: "#fecaca",
                      background: "rgba(244,63,94,0.08)",
                    }}
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="group data-value relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-opacity disabled:opacity-45"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5 0%, #6366f1 40%, #3730a3 100%)",
                    color: "#fafafa",
                    boxShadow: "0 0 28px rgba(79,70,229,0.4), inset 0 1px 0 rgba(255,255,255,0.14)",
                  }}
                  whileHover={prefersReducedMotion || loading ? undefined : { scale: 1.015 }}
                  whileTap={prefersReducedMotion || loading ? undefined : { scale: 0.985 }}
                >
                  {!prefersReducedMotion && (
                    <motion.span
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                      style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                      }}
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  {loading ? "Validando credenciales…" : (
                    <>
                      Autorizar ingreso
                      <ChevronRight size={18} className="opacity-90" strokeWidth={2} aria-hidden />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </div>

          <p
            className="data-value mx-auto mt-7 max-w-sm text-center text-[9px] leading-relaxed tracking-[0.14em]"
            style={{ color: "rgba(71,85,105,0.72)" }}
          >
            core.vertia.net.ar · acceso sujeto a políticas de uso ·{" "}
            <span className="whitespace-nowrap">registro de auditoría habilitado</span>
          </p>
        </motion.div>
      </div>

      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute bottom-[-22%] left-1/2 z-[1] h-[min(80vw,520px)] w-[min(80vw,520px)] -translate-x-1/2 rounded-full border border-indigo-500/[0.06]"
          style={{ boxShadow: "inset 0 0 88px rgba(79,70,229,0.05)" }}
          animate={{ rotate: -360, scale: [1, 1.015, 1] }}
          transition={{
            rotate: { duration: 160, repeat: Infinity, ease: "linear" },
            scale: { duration: 10, repeat: Infinity },
          }}
        />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-3 data-value text-xs tracking-[0.32em]"
          style={{ background: "#000814", color: "#a5b4fc" }}
        >
          <motion.div
            className="h-1 w-28 overflow-hidden rounded-full"
            style={{ background: "rgba(79,70,229,0.22)" }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #22d3ee)" }}
              animate={{ x: ["0%", "220%", "0%"] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          VERIFICANDO ENLACE SEGURO…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
