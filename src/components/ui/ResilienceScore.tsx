"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── AI Insight engine ─────────────────────────────────────────────────────────

interface Insight {
  icon: React.ElementType;
  tone: "green" | "amber" | "red" | "blue";
  headline: string;
  detail: string;
}

interface InsightContext {
  score: number;
  prevScore: number;
  failedLinks?: number;
  congested?: boolean;
  backupSaturated?: boolean;
  allSitesUp?: boolean;
}

function deriveInsight(ctx: InsightContext): Insight {
  const { score, prevScore, failedLinks = 0, congested = false, backupSaturated = false } = ctx;
  const trend = score - prevScore;
  if (failedLinks > 0 && score < 70)
    return { icon: AlertTriangle, tone: "red",   headline: "Falla de enlace activa",      detail: `${failedLinks} enlace${failedLinks > 1 ? "s" : ""} fuera de servicio. Failover Zero-Touch activado.` };
  if (backupSaturated)
    return { icon: AlertTriangle, tone: "amber", headline: "Enlace de backup saturado",   detail: "El enlace de contingencia supera el 88% de capacidad. Redistribuir carga inmediatamente." };
  if (congested)
    return { icon: TrendingDown,  tone: "amber", headline: "Congestión detectada",        detail: "Uno o más sitios superan el 85% de uso. SD-WAN rebalanceando tráfico en tiempo real." };
  if (score >= 95)
    return { icon: TrendingUp,    tone: "green", headline: "Estado Óptimo",               detail: `La red soporta un ${Math.round((score - 60) * 0.8)}% más de carga operativa sin degradación.` };
  if (score >= 90)
    return { icon: TrendingUp,    tone: "green", headline: "Operación Nominal",           detail: "Todos los sitios conectados. Redundancia activa en standby para failover inmediato." };
  if (score >= 75 && trend > 2)
    return { icon: TrendingUp,    tone: "blue",  headline: "Recuperación en curso",       detail: `Score subió +${trend.toFixed(0)} pts. El sistema está restaurando redundancia automáticamente.` };
  if (score >= 75)
    return { icon: Minus,         tone: "amber", headline: "Estado Estable con Alertas",  detail: "Rendimiento aceptable. Se recomienda revisar enlaces degradados en panel ISP." };
  if (score >= 60)
    return { icon: TrendingDown,  tone: "amber", headline: "Resiliencia Reducida",        detail: "La red opera sin redundancia plena. Activar Modo Contingencia si el score baja de 60%." };
  return   { icon: AlertTriangle, tone: "red",   headline: "Infraestructura en Riesgo",   detail: "Score crítico. Activar Modo Contingencia y ejecutar protocolo de failover manual." };
}

const TONE = {
  green: { text: "#10B981", border: "rgba(16,185,129,0.2)",   bg: "rgba(16,185,129,0.06)",  glow: "rgba(16,185,129,0.6)"  },
  amber: { text: "#F59E0B", border: "rgba(245,158,11,0.2)",   bg: "rgba(245,158,11,0.06)",  glow: "rgba(245,158,11,0.6)"  },
  red:   { text: "#F43F5E", border: "rgba(244,63,94,0.25)",   bg: "rgba(244,63,94,0.07)",   glow: "rgba(244,63,94,0.65)"  },
  blue:  { text: "#818cf8", border: "rgba(129,140,248,0.2)",  bg: "rgba(129,140,248,0.06)", glow: "rgba(129,140,248,0.5)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ResilienceScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showInsight?: boolean;
  insightContext?: Omit<InsightContext, "score" | "prevScore">;
  className?: string;
}

const SIZE = {
  sm: { r: 30, track: 3,   outer: 3,   spinR: 0,   fontSize: 18, pctSize: 10, labelSize: 9  },
  md: { r: 46, track: 3.5, outer: 3.5, spinR: 0,   fontSize: 26, pctSize: 11, labelSize: 10 },
  lg: { r: 66, track: 4.5, outer: 4.5, spinR: 58,  fontSize: 42, pctSize: 13, labelSize: 11 },
};

export default function ResilienceScore({
  score,
  size = "md",
  showLabel = true,
  showInsight = false,
  insightContext,
  className,
}: ResilienceScoreProps) {
  const [display, setDisplay] = useState(0);
  const [prev, setPrev] = useState(score);
  const prevRef = useRef(score);
  const rafRef  = useRef<number | null>(null);

  const cfg = SIZE[size];
  const norm = Math.min(100, Math.max(0, score));
  const C  = 2 * Math.PI * cfg.r;
  const C2 = cfg.spinR > 0 ? 2 * Math.PI * (cfg.spinR) : 0;
  const offset  = C - (norm / 100) * C;
  const svgSize = (cfg.r + cfg.outer + 10) * 2;
  const cx = svgSize / 2;

  const scoreColor = score >= 90 ? "#10B981" : score >= 70 ? "#F59E0B" : "#F43F5E";
  const glowColor  = score >= 90
    ? "rgba(16,185,129,0.7)"
    : score >= 70
      ? "rgba(245,158,11,0.7)"
      : "rgba(244,63,94,0.7)";

  const labelText = score >= 90 ? "ÓPTIMO" : score >= 70 ? "ESTABLE" : score >= 50 ? "DEGRADADO" : "CRÍTICO";

  const insight = deriveInsight({ score, prevScore: prev, ...insightContext });
  const InsightIcon = insight.icon;
  const t = TONE[insight.tone];

  // Animate counter
  useEffect(() => {
    const from = display;
    const to   = norm;
    if (from === to) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norm]);

  // Track prev for trend
  useEffect(() => {
    if (Math.abs(score - prevRef.current) >= 1) {
      setPrev(prevRef.current);
      prevRef.current = score;
    }
  }, [score]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>

      {/* ── Dial ──────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
          overflow="visible"
        >
          <defs>
            {/* Neon blur layers */}
            <filter id={`rs-neon-${size}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5"  result="b1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b2" />
              <feMerge>
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`rs-glow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Outer decorative spinning dashes ring (lg only) ── */}
          {cfg.spinR > 0 && (
            <>
              <circle
                cx={cx} cy={cx} r={cfg.spinR}
                fill="none"
                stroke="rgba(79,70,229,0.1)"
                strokeWidth="1"
                strokeDasharray="4 8"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${cx} ${cx}`}
                  to={`360 ${cx} ${cx}`}
                  dur="16s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={cx} cy={cx} r={cfg.spinR - 4}
                fill="none"
                stroke="rgba(79,70,229,0.06)"
                strokeWidth="1"
                strokeDasharray="2 10"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`360 ${cx} ${cx}`}
                  to={`0 ${cx} ${cx}`}
                  dur="24s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}

          {/* ── Outer ring: wide track ── */}
          <circle
            cx={cx} cy={cx} r={cfg.r + cfg.outer}
            fill="none"
            stroke="rgba(79,70,229,0.08)"
            strokeWidth={cfg.outer}
          />
          {/* Outer ring: progress (thin accent) */}
          <circle
            cx={cx} cy={cx} r={cfg.r + cfg.outer}
            fill="none"
            stroke={scoreColor}
            strokeWidth={cfg.outer}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (cfg.r + cfg.outer)}
            strokeDashoffset={2 * Math.PI * (cfg.r + cfg.outer) - (norm / 100) * 2 * Math.PI * (cfg.r + cfg.outer)}
            opacity="0.35"
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
          />

          {/* ── Inner ring: main track ── */}
          <circle
            cx={cx} cy={cx} r={cfg.r}
            fill="none"
            stroke="rgba(79,70,229,0.1)"
            strokeWidth={cfg.track}
          />

          {/* Inner ring: glow blur layer */}
          <circle
            cx={cx} cy={cx} r={cfg.r}
            fill="none"
            stroke={scoreColor}
            strokeWidth={cfg.track + 2}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            opacity="0.3"
            filter={`url(#rs-neon-${size})`}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
          />

          {/* Inner ring: crisp progress arc */}
          <circle
            cx={cx} cy={cx} r={cfg.r}
            fill="none"
            stroke={scoreColor}
            strokeWidth={cfg.track}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            filter={`url(#rs-glow-${size})`}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
          />

          {/* Endpoint dot — tip of the arc */}
          {norm > 3 && (() => {
            const angle = -Math.PI / 2 + (norm / 100) * 2 * Math.PI;
            const dx = Math.cos(angle) * cfg.r;
            const dy = Math.sin(angle) * cfg.r;
            return (
              <circle
                cx={cx + dx} cy={cx + dy}
                r={cfg.track - 0.5}
                fill={scoreColor}
                filter={`url(#rs-neon-${size})`}
                style={{ transition: "cx 0.9s cubic-bezier(0.4,0,0.2,1), cy 0.9s cubic-bezier(0.4,0,0.2,1)" }}
              />
            );
          })()}
        </svg>

        {/* ── Center text (not rotated) ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="data-value font-bold leading-none tabular-nums"
            style={{
              fontSize: cfg.fontSize,
              color: scoreColor,
              textShadow: `0 0 12px ${glowColor}, 0 0 28px ${glowColor}`,
              transition: "color 0.4s",
            }}
          >
            {display}
          </span>
          <span
            className="data-value font-medium"
            style={{ fontSize: cfg.pctSize, color: "rgba(148,163,184,0.7)", marginTop: 2 }}
          >
            %
          </span>
          {showLabel && (
            <span
              className="data-value font-semibold tracking-widest"
              style={{
                fontSize: cfg.labelSize,
                color: scoreColor,
                marginTop: 4,
                textShadow: `0 0 8px ${glowColor}`,
                transition: "color 0.4s",
              }}
            >
              {labelText}
            </span>
          )}
        </div>
      </div>

      {/* ── AI Insight panel ──────────────────────────────────────────── */}
      {showInsight && (
        <div
          className="w-full rounded-lg px-3 py-2.5 transition-all duration-500"
          style={{
            background: t.bg,
            border: `1px solid ${t.border}`,
            boxShadow: `inset 0 0 20px ${t.bg}`,
          }}
        >
          <div className="flex items-start gap-2">
            <Brain size={10} className="flex-shrink-0 mt-0.5" style={{ color: "rgba(100,116,139,0.8)" }} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <InsightIcon size={11} className="flex-shrink-0" style={{ color: t.text }} />
                <span
                  className="data-value font-semibold text-[11px]"
                  style={{ color: t.text, textShadow: `0 0 8px ${t.glow}` }}
                >
                  {insight.headline}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(148,163,184,0.8)" }}>
                {insight.detail}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
