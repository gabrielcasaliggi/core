"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, X, Thermometer, Zap, Cpu, MemoryStick, Router } from "lucide-react";
import { getSiteStatusColor } from "@/lib/telemetry/mock-data";
import { useNetwork } from "@/context/NetworkContext";
import type { Site, DataFlow } from "@/types/telemetry";

interface CoreMapProps {
  sites: Site[];
  flows: DataFlow[];
  className?: string;
}

interface Pt { x: number; y: number; }
interface ProjectedSite extends Site, Pt {}

interface Transform { zoom: number; panX: number; panY: number; }
const DEFAULT_TRANSFORM: Transform = { zoom: 1, panX: 0, panY: 0 };
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 5;

// ── Geo projection ─────────────────────────────────────────────────────────

function project(lat: number, lng: number, bounds: Bounds, W: number, H: number, pad = 110): Pt {
  return {
    x: pad + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (W - pad * 2),
    y: pad + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (H - pad * 2),
  };
}

interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

// ── Link type palette (Hyper-Network) ─────────────────────────────────────

const LINK_COLORS: Record<string, { stroke: string; label: string }> = {
  fiber:     { stroke: "#4F46E5", label: "Fibra Óptica"  },  // Electric Indigo
  radiolink: { stroke: "#10B981", label: "Radioenlace"   },  // Emerald Phosphor
  starlink:  { stroke: "#94a3b8", label: "Starlink"      },  // Slate
};

// ── Network node: HQ = Rombo / Branch = Círculos concéntricos ─────────────

/** Rombo (diamond) para nodo HQ — símbolo de nodo de distribución central */
function HQDiamond({ x, y, color, scale = 1 }: {
  x: number; y: number; color: string; scale?: number;
}) {
  const s = scale;
  const h = 18 * s;  // half-height
  const w = 13 * s;  // half-width
  const cx = x, cy = y - h;
  const pts = `${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`;
  return (
    <g>
      {/* Relleno translúcido */}
      <polygon points={pts} fill={`${color}12`} />
      {/* Borde exterior */}
      <polygon points={pts} fill="none" stroke={color} strokeWidth="1.4" />
      {/* Diagonal interior (eje vertical) */}
      <line x1={cx} y1={cy - h + 4} x2={cx} y2={cy + h - 4}
        stroke={color} strokeWidth="0.5" opacity="0.35" />
      {/* Diagonal interior (eje horizontal) */}
      <line x1={cx - w + 4} y1={cy} x2={cx + w - 4} y2={cy}
        stroke={color} strokeWidth="0.5" opacity="0.35" />
      {/* Punto central */}
      <circle cx={cx} cy={cy} r="2.5" fill={color} opacity="0.9" />
    </g>
  );
}

/** Círculos concéntricos para nodos de borde (branches, remotes, studios) */
function EdgeNode({ x, y, color, scale = 1 }: {
  x: number; y: number; color: string; scale?: number;
}) {
  const s = scale;
  const cy = y - 14 * s;
  return (
    <g>
      {/* Anillo exterior — radio de alcance */}
      <circle cx={x} cy={cy} r={16 * s} fill="none"
        stroke={color} strokeWidth="0.7" opacity="0.18" strokeDasharray="3 3" />
      {/* Anillo medio — zona de cobertura */}
      <circle cx={x} cy={cy} r={10 * s} fill="none"
        stroke={color} strokeWidth="0.9" opacity="0.4" />
      {/* Anillo interior — nodo físico */}
      <circle cx={x} cy={cy} r={5 * s}
        fill={`${color}18`} stroke={color} strokeWidth="1.2" opacity="0.85" />
      {/* Punto central */}
      <circle cx={x} cy={cy} r={2 * s} fill={color} opacity="0.95" />
    </g>
  );
}

// ── Ping rings (SVG native) ────────────────────────────────────────────────

function PingRings({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      <circle cx={x} cy={y} r="0" fill="none" stroke={color} strokeWidth="1.2" opacity="0">
        <animate attributeName="r"       from="10" to="36" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0"  dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="0" fill="none" stroke={color} strokeWidth="0.7" opacity="0">
        <animate attributeName="r"       from="10" to="54" dur="2.6s" begin="0.9s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.25" to="0" dur="2.6s" begin="0.9s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CoreMap({ sites, flows, className }: CoreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [dim, setDim]           = useState({ w: 860, h: 480 });
  const [hovered, setHovered]   = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tf, setTf]             = useState<Transform>(DEFAULT_TRANSFORM);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const { getRealSite } = useNetwork();

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setDim({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect  = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setTf(prev => {
        const delta    = e.deltaY > 0 ? 0.88 : 1.14;
        const newZoom  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * delta));
        const scale    = newZoom / prev.zoom;
        // Zoom toward cursor
        const newPanX  = mouseX - scale * (mouseX - prev.panX);
        const newPanY  = mouseY - scale * (mouseY - prev.panY);
        return { zoom: newZoom, panX: newPanX, panY: newPanY };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag pan ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: tf.panX, startPanY: tf.panY };
  }, [tf]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTf(prev => ({ ...prev, panX: dragRef.current!.startPanX + dx, panY: dragRef.current!.startPanY + dy }));
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Click-to-zoom on a site ───────────────────────────────────────────
  const zoomToSite = useCallback((site: ProjectedSite) => {
    setIsTransitioning(true);
    const targetZoom = 2.8;
    const panX = dim.w / 2 - site.x * targetZoom;
    const panY = dim.h / 2 - site.y * targetZoom;
    setTf({ zoom: targetZoom, panX, panY });
    setSelected(site.id);
    setTimeout(() => setIsTransitioning(false), 350);
  }, [dim]);

  const resetView = useCallback(() => {
    setIsTransitioning(true);
    setTf(DEFAULT_TRANSFORM);
    setSelected(null);
    setTimeout(() => setIsTransitioning(false), 350);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setTf(prev => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const scale   = newZoom / prev.zoom;
      const cx = dim.w / 2, cy = dim.h / 2;
      return {
        zoom: newZoom,
        panX: cx - scale * (cx - prev.panX),
        panY: cy - scale * (cy - prev.panY),
      };
    });
  }, [dim]);

  const lats = sites.map(s => s.coords.lat);
  const lngs = sites.map(s => s.coords.lng);

  // Dynamic bounds: spread scales with number of sites so nodes never cluster
  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);
  const latPad = Math.max(2.5, latRange * 0.7);
  const lngPad = Math.max(3.0, lngRange * 1.2);

  const bounds: Bounds = {
    minLat: Math.min(...lats) - latPad,
    maxLat: Math.max(...lats) + latPad,
    minLng: Math.min(...lngs) - lngPad,
    maxLng: Math.max(...lngs) + lngPad,
  };

  const proj = (lat: number, lng: number) => project(lat, lng, bounds, dim.w, dim.h);

  const projected: ProjectedSite[] = sites.map(s => ({ ...s, ...proj(s.coords.lat, s.coords.lng) }));
  const byId = Object.fromEntries(projected.map(s => [s.id, s]));

  // Group flows by connection pair for bezier control offset
  const flowsByPair: Record<string, DataFlow[]> = {};
  for (const f of flows) {
    const key = [f.sourceId, f.targetId].sort().join("|");
    flowsByPair[key] = [...(flowsByPair[key] ?? []), f];
  }

  const selectedSite = selected ? projected.find(s => s.id === selected) ?? null : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className ?? ""}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
    >
      {/* Radial vignette */}
      <div className="absolute inset-0 pointer-events-none z-10"
        style={{ background: "radial-gradient(ellipse 95% 90% at 50% 50%, transparent 50%, rgba(0,8,20,0.75) 100%)" }} />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${dim.w} ${dim.h}`}
        width="100%" height="100%"
        className="absolute inset-0"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <defs>
          {/* Filters */}
          <filter id="neon-c" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4"  result="b1" />
            <feGaussianBlur stdDeviation="10" result="b2" />
            <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="neon-g" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b2" />
            <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="neon-w" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b1" />
            <feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="neon-r" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5"  result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b2" />
            <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="bldg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* HUD grid pattern */}
          <pattern id="hud-g" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(0,212,255,0.035)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Grid (fixed, no transform) */}
        <rect width="100%" height="100%" fill="url(#hud-g)" />

        {/* ── Zoomable / pannable group ─────────────────────────────── */}
        <g
          transform={`translate(${tf.panX}, ${tf.panY}) scale(${tf.zoom})`}
          style={{ transition: isTransitioning ? "transform 0.35s cubic-bezier(0.4,0,0.2,1)" : "none" }}
        >

        {/* ── Connection lines (mesh) ────────────────────────────────── */}
        {flows.map((flow, fi) => {
          const src = byId[flow.sourceId];
          const tgt = byId[flow.targetId];
          if (!src || !tgt) return null;

          const key = [flow.sourceId, flow.targetId].sort().join("|");
          const siblings = flowsByPair[key] ?? [flow];
          const idx = siblings.indexOf(flow);
          const bezOffset = (idx - (siblings.length - 1) / 2) * 0.18;

          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const cpx = mx - dy * bezOffset;
          const cpy = my + dx * bezOffset;
          const pathD = `M ${src.x} ${src.y} Q ${cpx} ${cpy} ${tgt.x} ${tgt.y}`;
          const pid = `fp-${flow.id}`;

          // ── Carga real del enlace desde el sitio fuente ────────────────
          const srcSite = sites.find(s => s.id === flow.sourceId);
          const activeLink = srcSite?.links.find(l => l.status === "active");
          const loadPct = activeLink
            ? activeLink.usageMbps / activeLink.bandwidthMbps
            : flow.throughputMbps / 120;

          // Si el link está down → estático rojo sin animación
          const isDown = flow.throughputMbps === 0 &&
            srcSite?.links.every(l => l.status !== "active");

          // Carga > 80% → ámbar; congestionado → Neon Rose; normal → paleta tipo
          const isOverloaded = loadPct > 0.8 && !isDown;
          const flowColor = isDown       ? "#F43F5E"
            : isOverloaded               ? "#F59E0B"   // Amber — saturación
            : flow.connectionType === "fiber"      ? "#4F46E5"   // Electric Indigo
            : flow.connectionType === "radiolink"  ? "#10B981"   // Emerald Phosphor
            : "#94a3b8";                                          // Starlink slate

          const filterId = isDown || flow.congested ? "neon-r"
            : flow.connectionType === "fiber"     ? "neon-c"
            : flow.connectionType === "radiolink"  ? "neon-g"
            : "neon-w";

          const isStarlink = flow.connectionType === "starlink";

          // Velocidad proporcional a la carga real del enlace fuente
          // loadPct=0 → dur 4.5s | loadPct=1 → dur 0.8s
          const dur = isDown ? 0 : Math.max(0.8, 4.5 - loadPct * 3.7);
          const traceWidth = isDown ? 1 : 0.6 + loadPct * 1.6;

          // Enlace down: rojo, punteado estático — sin flow animation
          if (isDown) {
            return (
              <g key={flow.id}>
                <path d={pathD} fill="none" stroke="#F43F5E" strokeWidth="1"
                  strokeDasharray="3 5" opacity="0.45" />
                <text x={cpx} y={cpy - 5} textAnchor="middle"
                  fill="#F43F5E" fontSize="7" opacity="0.6"
                  fontFamily="'JetBrains Mono', monospace">DOWN</text>
              </g>
            );
          }

          return (
            <g key={flow.id}>
              <defs><path id={pid} d={pathD} /></defs>

              {/* Glow halo (intensidad = carga) */}
              <path d={pathD} fill="none" stroke={flowColor}
                strokeWidth={6 + loadPct * 5} opacity={0.03 + loadPct * 0.07} />
              {/* Base trace */}
              <path d={pathD} fill="none" stroke={flowColor} strokeWidth={traceWidth}
                opacity={0.2 + loadPct * 0.15}
                strokeDasharray={isStarlink ? "4 4" : undefined} />
              {/* Animated dashes */}
              <path d={pathD} fill="none" stroke={flowColor}
                strokeWidth={traceWidth + 0.5}
                strokeDasharray={isStarlink ? "3 6" : "6 10"}
                opacity={0.5 + loadPct * 0.45}
                filter={`url(#${filterId})`}>
                <animate attributeName="stroke-dashoffset" from="60" to="0"
                  dur={`${dur}s`} repeatCount="indefinite" />
              </path>

              {/* Partículas — velocidad y cantidad dependen de loadPct */}
              <>
                <circle r={2.2 + loadPct * 1.4} fill={flowColor}
                  opacity={0.85 + loadPct * 0.15} filter={`url(#${filterId})`}>
                  <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin="0s">
                    <mpath href={`#${pid}`} />
                  </animateMotion>
                </circle>
                <circle r={1.6 + loadPct * 0.8} fill={flowColor} opacity="0.5">
                  <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${-dur / 3}s`}>
                    <mpath href={`#${pid}`} />
                  </animateMotion>
                </circle>
                <circle r={1.1 + loadPct * 0.5} fill={flowColor} opacity="0.28">
                  <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${-dur * 2 / 3}s`}>
                    <mpath href={`#${pid}`} />
                  </animateMotion>
                </circle>
                {/* 4ta partícula solo si carga > 60% */}
                {loadPct > 0.6 && (
                  <circle r="1.2" fill={flowColor} opacity="0.18">
                    <animateMotion dur={`${dur * 0.7}s`} repeatCount="indefinite" begin={`${-dur / 5}s`}>
                      <mpath href={`#${pid}`} />
                    </animateMotion>
                  </circle>
                )}
              </>

              {/* Label carga en tiempo real */}
              <text x={cpx} y={cpy - 7} textAnchor="middle"
                fill={flowColor} fontSize="7" opacity={0.45 + loadPct * 0.4}
                fontFamily="'JetBrains Mono', monospace">
                [{(loadPct * 100).toFixed(0)}%]
              </text>
            </g>
          );
        })}

        {/* ── Site nodes ─────────────────────────────────────────────── */}
        {projected.map(site => {
          const color  = getSiteStatusColor(site.status);
          const isHQ   = site.type === "headquarters";
          const isHov  = hovered === site.id;
          const isSel  = selected === site.id;
          const nodeScale = isHov || isSel ? 1.2 : 1;
          // Posición del centro del nodo (consistente entre HQ y Edge)
          const nodeCy   = isHQ ? site.y - 18 : site.y - 14;

          return (
            <g key={site.id}
              onMouseEnter={() => setHovered(site.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => isSel ? resetView() : zoomToSite(site)}
              style={{ cursor: "pointer" }}
              filter="url(#bldg-glow)"
            >
              {/* Selection ring */}
              {isSel && (
                <circle cx={site.x} cy={nodeCy} r={isHQ ? 34 : 26}
                  fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.45" />
              )}

              {/* Ping rings */}
              <PingRings x={site.x} y={nodeCy} color={color} />

              {/* Símbolo de red: Rombo para HQ, Círculos concéntricos para branches */}
              {isHQ
                ? <HQDiamond  x={site.x} y={site.y} color={color} scale={nodeScale} />
                : <EdgeNode   x={site.x} y={site.y} color={color} scale={nodeScale} />
              }

              {/* Site name — JetBrains Mono */}
              <text x={site.x} y={site.y + (isHQ ? 6 : 4)} textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace"
                fill="rgba(255,255,255,0.88)" fontSize={isHQ ? 10 : 9} fontWeight="600"
                letterSpacing="0.04em">
                {site.name.toUpperCase()}
              </text>
              <text x={site.x} y={site.y + (isHQ ? 16 : 14)} textAnchor="middle"
                fill={color} fontSize="7.5" opacity="0.7"
                fontFamily="'JetBrains Mono', monospace">
                [ {site.resilienceScore}% ] · {site.connectedDevices}d
              </text>
            </g>
          );
        })}

        {/* Close the zoomable group */}
        </g>

        {/* ── HUD corner brackets ────────────────────────────────────── */}
        {([[8,8,20,0,0,20],[dim.w-8,8,-20,0,0,20],[8,dim.h-8,20,0,0,-20],[dim.w-8,dim.h-8,-20,0,0,-20]] as number[][]).map(([x,y,dx1,dy1,dx2,dy2],i)=>(
          <g key={i} opacity="0.3">
            <line x1={x} y1={y} x2={x+dx1} y2={y+dy1} stroke="#4F46E5" strokeWidth="1.5"/>
            <line x1={x} y1={y} x2={x+dx2} y2={y+dy2} stroke="#4F46E5" strokeWidth="1.5"/>
          </g>
        ))}

        {/* Map title */}
        <text x={dim.w / 2} y={20} textAnchor="middle"
          fill="rgba(79,70,229,0.5)" fontSize="9.5" fontWeight="600" letterSpacing="4"
          fontFamily="'JetBrains Mono', monospace">
          NEXUS-MAP · SD-WAN MESH · EPSG:4326
        </text>

        {/* Bottom HUD bar */}
        <text x={12} y={dim.h - 8} fill="rgba(79,70,229,0.3)" fontSize="7.5"
          fontFamily="'JetBrains Mono', monospace">
          VERTIA CORE · PLANO DE CONTROL OPERATIVO
        </text>
        <text x={dim.w - 12} y={dim.h - 8} fill="rgba(79,70,229,0.3)" fontSize="7.5"
          textAnchor="end" fontFamily="'JetBrains Mono', monospace">
          [{sites.length} NODOS] · [{flows.filter(f => f.throughputMbps > 0).length} FLUJOS ACTIVOS]
        </text>
      </svg>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="absolute top-6 left-4 flex flex-col gap-1.5 z-20"
        style={{ background: "rgba(0,8,24,0.75)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 6, padding: "8px 12px" }}>
        <p className="data-value text-[9px] tracking-widest mb-1" style={{ color: "rgba(0,212,255,0.5)" }}>TIPOS DE ENLACE</p>
        {Object.entries(LINK_COLORS).map(([type, { stroke, label }]) => (
          <div key={type} className="flex items-center gap-2">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke={stroke} strokeWidth="1.5"
                strokeDasharray={type === "starlink" ? "3 3" : undefined} />
            </svg>
            <span className="data-value text-[9px]" style={{ color: "rgba(148,163,184,0.7)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Zoom controls ──────────────────────────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5">
        <button onClick={() => zoomBy(1.25)}
          className="w-8 h-8 flex items-center justify-center rounded border border-cyan-500/30 bg-black/70 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          title="Acercar">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => zoomBy(0.8)}
          className="w-8 h-8 flex items-center justify-center rounded border border-cyan-500/30 bg-black/70 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          title="Alejar">
          <ZoomOut size={14} />
        </button>
        <button onClick={resetView}
          className="w-8 h-8 flex items-center justify-center rounded border border-cyan-500/30 bg-black/70 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          title="Vista general">
          <Maximize2 size={13} />
        </button>
      </div>

      {/* ── Zoom level / hint bar ──────────────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <span className="text-[9px] font-mono text-cyan-500/40 tracking-widest">
          ×{tf.zoom.toFixed(1)}
          {tf.zoom <= 1.1 && !selected && (
            <span className="ml-3 text-slate-500/50">  CLICK EN EDIFICIO · SCROLL PARA ZOOM · DRAG PARA MOVER</span>
          )}
          {tf.zoom > 1.1 && (
            <span className="ml-3 text-amber-400/50"> SCROLL PARA ALEJAR</span>
          )}
        </span>
      </div>

      {/* ── Site detail panel (HTML overlay, no zoom distortion) ─────── */}
      {selectedSite && (() => {
        const realData = getRealSite(selectedSite.id);
        const sc = getSiteStatusColor(selectedSite.status);
        return (
          <div
            className="absolute top-4 right-4 z-30 w-68 scan-in"
            style={{
              width: "17rem",
              background: "rgba(2,0,20,0.96)",
              border: "1px solid rgba(79,70,229,0.3)",
              borderRadius: "6px",
              backdropFilter: "blur(14px)",
              boxShadow: "0 0 32px rgba(79,70,229,0.12), 0 0 16px rgba(6,182,212,0.06), inset 0 0 0 1px rgba(255,255,255,0.02)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-indigo-500/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: sc, boxShadow: `0 0 6px ${sc}` }} />
                <span className="text-[11px] font-mono font-semibold tracking-wider truncate"
                  style={{ color: "#a5b4fc" }}>
                  {selectedSite.name.toUpperCase()}
                </span>
                {realData && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                    LIVE
                  </span>
                )}
              </div>
              <button onClick={resetView}
                className="text-slate-600 hover:text-slate-200 transition-colors ml-2 flex-shrink-0">
                <X size={13} />
              </button>
            </div>

            {/* Resilience Score */}
            <div className="px-3 py-2 border-b border-slate-800/50 flex items-center justify-between">
              <span className="text-[9px] font-mono text-slate-500 tracking-widest">RESILIENCE SCORE</span>
              <span className="text-base font-mono font-bold"
                style={{ color: sc, textShadow: `0 0 10px ${sc}88` }}>
                {selectedSite.resilienceScore}%
              </span>
            </div>

            {/* Hardware metrics — solo para routers reales */}
            {realData && (
              <div className="px-3 py-2 border-b border-slate-800/50 space-y-1.5">
                <span className="text-[9px] font-mono text-slate-500 tracking-widest block">HARDWARE · {realData.boardName}</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {/* CPU */}
                  <div className="flex items-center gap-1.5">
                    <Cpu size={9} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-[9px] font-mono text-slate-400">CPU</span>
                    <span className="text-[10px] font-mono ml-auto"
                      style={{ color: realData.cpuLoad > 80 ? "#ef4444" : realData.cpuLoad > 50 ? "#f59e0b" : "#10b981" }}>
                      {realData.cpuLoad}%
                    </span>
                  </div>
                  {/* RAM */}
                  <div className="flex items-center gap-1.5">
                    <MemoryStick size={9} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-[9px] font-mono text-slate-400">RAM</span>
                    <span className="text-[10px] font-mono ml-auto"
                      style={{ color: realData.ramUsedPct > 85 ? "#ef4444" : realData.ramUsedPct > 65 ? "#f59e0b" : "#10b981" }}>
                      {realData.ramUsedPct}%
                    </span>
                  </div>
                  {/* Temperatura CPU */}
                  {realData.cpuTempC !== null && (
                    <div className="flex items-center gap-1.5">
                      <Thermometer size={9} className="text-indigo-400 flex-shrink-0" />
                      <span className="text-[9px] font-mono text-slate-400">TEMP</span>
                      <span className="text-[10px] font-mono ml-auto"
                        style={{ color: realData.cpuTempC > 70 ? "#ef4444" : realData.cpuTempC > 55 ? "#f59e0b" : "#10b981" }}>
                        {realData.cpuTempC}°C
                      </span>
                    </div>
                  )}
                  {/* Voltaje */}
                  {realData.voltageV !== null && (
                    <div className="flex items-center gap-1.5">
                      <Zap size={9} className="text-indigo-400 flex-shrink-0" />
                      <span className="text-[9px] font-mono text-slate-400">VOLT</span>
                      <span className="text-[10px] font-mono ml-auto"
                        style={{ color: realData.voltageV < 10.5 ? "#ef4444" : "#10b981" }}>
                        {realData.voltageV.toFixed(1)}V
                      </span>
                    </div>
                  )}
                  {/* RouterOS version */}
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Router size={9} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-[9px] font-mono text-slate-400">RouterOS</span>
                    <span className="text-[9px] font-mono ml-auto text-slate-300">{realData.rosVersion}</span>
                  </div>
                </div>
                {/* WAN gateway activo */}
                {realData.activeWanGateway && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[9px] font-mono text-slate-500">GW ACTIVO</span>
                    <span className="text-[9px] font-mono text-emerald-400">{realData.activeWanGateway}</span>
                  </div>
                )}
              </div>
            )}

            {/* Links */}
            <div className="px-3 py-2 space-y-1.5 border-b border-slate-800/70">
              <span className="text-[9px] font-mono text-slate-500 tracking-widest block mb-1.5">ENLACES DE RED</span>
              {selectedSite.links.map(l => {
                const lc = l.status === "active" ? "#10b981" : l.status === "standby" ? "#f59e0b" : "#ef4444";
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lc }} />
                    <span className="text-[10px] font-mono text-slate-300 flex-1 truncate">
                      {l.type.toUpperCase()} · {l.provider}
                    </span>
                    <span className="text-[9px] font-mono flex-shrink-0" style={{ color: lc }}>
                      {l.status === "active" ? `${l.latencyMs}ms` : l.status.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* VPN Tunnels */}
            {selectedSite.vpnTunnels.length > 0 && (
              <div className="px-3 py-2 space-y-1 border-b border-slate-800/70">
                <span className="text-[9px] font-mono text-slate-500 tracking-widest block mb-1.5">TÚNELES VPN</span>
                {selectedSite.vpnTunnels.map(t => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-400 truncate flex-1 mr-2">{t.targetSiteId}</span>
                    <span className={`text-[9px] font-mono flex-shrink-0 ${t.status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                      {t.status.toUpperCase()} · {t.protocol}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer stats */}
            <div className="px-3 py-2.5 grid grid-cols-3 gap-2">
              {[
                { label: "USUARIOS",     value: String(selectedSite.activeUsers) },
                { label: "DISPOSITIVOS", value: String(selectedSite.connectedDevices) },
                { label: "FIREWALL",     value: selectedSite.firewallEnabled ? "ON" : "OFF" },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="text-[12px] font-mono font-semibold text-cyan-300">{item.value}</div>
                  <div className="text-[7.5px] font-mono text-slate-500 tracking-widest leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
