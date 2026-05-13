"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkSnapshot, Link, DataFlow, Site } from "@/types/telemetry";
import { MOCK_NETWORK_SNAPSHOT } from "./mock-data";

// ── Fluctuation engine ────────────────────────────────────────────────────────

/**
 * Applies a small random jitter (±maxPct % of the base value) to a number,
 * clamped between [min, max].
 */
function jitter(base: number, maxPct: number, min: number, max: number): number {
  const delta = base * maxPct * (Math.random() * 2 - 1);
  return Math.min(max, Math.max(min, parseFloat((base + delta).toFixed(1))));
}

function fluctuateLink(link: Link): Link {
  if (link.status === "failed") return link;

  const isActive = link.status === "active";

  return {
    ...link,
    usageMbps: isActive
      ? jitter(link.usageMbps === 0 ? link.bandwidthMbps * 0.3 : link.usageMbps, 0.08, 0, link.bandwidthMbps * 0.95)
      : 0,
    latencyMs: isActive
      ? jitter(link.latencyMs || 5, 0.12, 1, link.type === "starlink" ? 80 : 30)
      : 0,
    uptimePercent: jitter(link.uptimePercent, 0.001, 80, 100),
  };
}

/**
 * Calcula el score de resiliencia de un sitio de forma DETERMINISTA
 * a partir del estado real de sus enlaces — sin aleatoriedad.
 *
 * Fórmula:
 *   base = 100
 *   - Por cada enlace fallado:        -22 pts
 *   - Por carga activa > 85%:         -(load - 0.85) * 45 pts por enlace
 *   - Sin ningún enlace activo:       -50 pts adicionales (sitio aislado)
 */
function computeSiteScore(links: Link[]): number {
  const total  = links.length;
  if (total === 0) return 0;

  const failed = links.filter(l => l.status === "failed").length;
  const active = links.filter(l => l.status === "active");

  let score = 100;
  score -= (failed / total) * 22 * failed;

  if (active.length === 0) {
    score -= 50;
  } else {
    for (const l of active) {
      const load = l.usageMbps / l.bandwidthMbps;
      if (load > 0.85) score -= (load - 0.85) * 45;
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function fluctuateSite(site: Site): Site {
  const newLinks = site.links.map(fluctuateLink);

  // Score determinístico — refleja directamente el estado de los enlaces
  const score = computeSiteScore(newLinks);

  return {
    ...site,
    resilienceScore: score,
    lastUpdated: new Date().toISOString(),
    links: newLinks,
  };
}

function fluctuateFlow(flow: DataFlow, sites: Site[]): DataFlow {
  // Flow throughput correlates with active link usage of source site
  const srcSite = sites.find((s) => s.id === flow.sourceId);
  const baseUsage = srcSite?.links.find((l) => l.status === "active")?.usageMbps ?? flow.throughputMbps;
  const base = Math.min(flow.throughputMbps, baseUsage * 0.2);
  return {
    ...flow,
    throughputMbps: parseFloat(jitter(base || flow.throughputMbps, 0.1, 1, 500).toFixed(1)),
  };
}

/**
 * Score global = promedio ponderado de los scores de sitios activos.
 * Pesos por criticidad operativa (HQ tiene mayor impacto).
 * Sitios offline penalizan directamente el promedio con score=0.
 */
function computeGlobalScore(sites: Site[]): number {
  const weights: Record<string, number> = {
    headquarters: 0.45,
    branch:       0.30,
    studio:       0.15,
    remote:       0.10,
  };
  let weightSum = 0;
  let scoreSum  = 0;
  for (const site of sites) {
    const w = weights[site.type] ?? 0.1;
    // Sitio offline = score 0 en el promedio (penaliza globalmente)
    const s = site.status === "offline" ? 0 : site.resilienceScore;
    scoreSum  += s * w;
    weightSum += w;
  }
  return Math.round(scoreSum / weightSum);
}

/**
 * Produces a new NetworkSnapshot with realistic fluctuations applied.
 * The base snapshot is never mutated.
 */
export function tickSnapshot(prev: NetworkSnapshot): NetworkSnapshot {
  const newSites = prev.sites.map(fluctuateSite);
  const newFlows = prev.flows.map((f) => fluctuateFlow(f, newSites));
  const globalScore = computeGlobalScore(newSites);

  // Dynamically inject an alert when any site crosses the 75% usage threshold
  const congestionAlerts = newSites.flatMap((site) =>
    site.links
      .filter((l) => l.status === "active" && l.usageMbps / l.bandwidthMbps > 0.88)
      .map((l) => ({
        id: `alert-congestion-${l.id}`,
        siteId: site.id,
        severity: "warning" as const,
        message: `Enlace ${l.type.toUpperCase()} en ${site.shortName} al ${Math.round((l.usageMbps / l.bandwidthMbps) * 100)}% de capacidad`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      }))
  );

  // Keep only non-congestion alerts plus fresh ones (deduplicated by link)
  const baseAlerts = prev.activeAlerts.filter(
    (a) => !a.id.startsWith("alert-congestion-")
  );

  return {
    ...prev,
    timestamp: new Date().toISOString(),
    globalResilienceScore: globalScore,
    sites: newSites,
    flows: newFlows,
    activeAlerts: [...baseAlerts, ...congestionAlerts],
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseTelemetryOptions {
  /** Interval in ms between updates. Default: 5000 */
  intervalMs?: number;
  /** Pause live updates (e.g. during "Modo Cierre") */
  paused?: boolean;
}

export function useTelemetry({
  intervalMs = 5000,
  paused = false,
}: UseTelemetryOptions = {}): NetworkSnapshot {
  // Usar el timestamp del mock estático para que SSR y cliente
  // tengan el mismo estado inicial y no haya mismatch de hidratación.
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>(MOCK_NETWORK_SNAPSHOT);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSnapshot((prev) => tickSnapshot(prev));
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, paused]);

  return snapshot;
}
