"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CampusNode } from "@throughline/hospital";
import type { OpsStation } from "@throughline/shared";
import { campus, node } from "../lib/campus";

/**
 * The front door's one bold element: Halden Medical Center as a 3D model, floors as slabs,
 * each station a column as tall as its queue, and a patient's thread drawn through the
 * building, stop by stop, floor by floor. Moving the pointer tilts it.
 */

const S = 1.55;
const GAP = 150;
const SLAB = 9;
const ORIGIN = { x: 300, y: 300 };

function iso(x: number, y: number, floor: number) {
  return { x: ORIGIN.x + (x - y) * S, y: ORIGIN.y + (x + y) * S * 0.5 - (floor - 1) * GAP };
}
const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

interface Slab {
  key: string;
  floor: number;
  top: string;
  left: string;
  right: string;
}

function slabs(): Slab[] {
  const groups = new Map<string, CampusNode[]>();
  for (const n of campus.nodes) {
    const key = `${n.building}-${n.floor}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups.entries()]
    .map(([key, nodes]) => {
      const pad = 9;
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const [x0, x1, y0, y1] = [
        Math.min(...xs) - pad,
        Math.max(...xs) + pad,
        Math.min(...ys) - pad,
        Math.max(...ys) + pad,
      ];
      const f = nodes[0]?.floor ?? 1;
      const a = iso(x0, y0, f);
      const b = iso(x1, y0, f);
      const c = iso(x1, y1, f);
      const d = iso(x0, y1, f);
      const down = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + SLAB });
      return {
        key,
        floor: f,
        top: [a, b, c, d].map(pt).join(" "),
        left: [d, c, down(c), down(d)].map(pt).join(" "),
        right: [c, b, down(b), down(c)].map(pt).join(" "),
      };
    })
    .sort((p, q) => p.floor - q.floor);
}

/** A patient's day through the building: check-in, labs, vitals, CT, clinic, infusion. */
const THREAD = ["mp1.lobby", "lab_draw", "vitals", "imaging_ct", "clinic_2a", "infusion"];

function stationNode(id: string): CampusNode | undefined {
  const s = campus.stations.find((x) => x.id === id);
  return node(s?.nodes[0] ?? id);
}

function threadPath(): string {
  const stops = THREAD.map((id) => (id.includes(".") ? node(id) : stationNode(id))).filter(
    (n): n is CampusNode => !!n,
  );
  const parts: string[] = [];
  stops.forEach((n, i) => {
    const here = iso(n.x, n.y, n.floor);
    if (i === 0) {
      parts.push(`M${pt(here)}`);
      return;
    }
    const prev = stops[i - 1] as CampusNode;
    if (prev.floor !== n.floor) {
      // Rise through the building at the previous stop, then walk across the new floor.
      parts.push(`L${pt(iso(prev.x, prev.y, n.floor))}`);
    }
    parts.push(`L${pt(here)}`);
  });
  return parts.join(" ");
}

function heat(minutes: number): { top: string; side: string } {
  if (minutes >= 20) return { top: "#e2583e", side: "#b42318" };
  if (minutes >= 10) return { top: "#f0a34a", side: "#c2700f" };
  return { top: "#5fb3a9", side: "#0f766e" };
}

export function CampusHero({ stations }: { stations: OpsStation[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const layers = useMemo(slabs, []);
  const path = useMemo(threadPath, []);
  const columns = useMemo(
    () =>
      stations
        .map((s) => {
          const n = node(s.node_id);
          if (!n) return undefined;
          const base = iso(n.x, n.y, n.floor);
          const h = Math.min(90, 10 + s.count * 5);
          return { s, base, h, color: heat(s.est_wait_min) };
        })
        .filter((c): c is NonNullable<typeof c> => !!c)
        // Draw back to front so nearer columns cover farther ones.
        .sort((a, b) => a.base.y - b.base.y),
    [stations],
  );
  // Fit the view to the whole building, columns and labels included.
  const view = useMemo(() => {
    const pts = layers.flatMap((l) =>
      `${l.top} ${l.left} ${l.right}`
        .split(" ")
        .map((p) => p.split(",").map(Number) as [number, number]),
    );
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return `${(x0 - 90).toFixed(0)} ${(y0 - 90).toFixed(0)} ${(x1 - x0 + 290).toFixed(0)} ${(y1 - y0 + 110).toFixed(0)}`;
  }, [layers]);
  const busiest = [...columns]
    .filter((c) => c.s.est_wait_min >= 5)
    .sort((a, b) => b.s.est_wait_min - a.s.est_wait_min)
    .slice(0, 3);
  return (
    <div
      ref={box}
      onPointerMove={(e) => {
        if (reduced || !box.current) return;
        const r = box.current.getBoundingClientRect();
        setTilt({
          x: (e.clientY - r.top) / r.height - 0.5,
          y: (e.clientX - r.left) / r.width - 0.5,
        });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative"
      style={{ perspective: "1400px" }}
    >
      <svg
        viewBox={view}
        role="img"
        aria-label={`Halden Medical Center in 3D: ${stations.length} stations, the busiest ${busiest.map((b) => `${b.s.name} ${Math.round(b.s.est_wait_min)} minutes`).join(", ")}`}
        className="w-full transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${(-tilt.x * 8).toFixed(2)}deg) rotateY(${(tilt.y * 10).toFixed(2)}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <defs>
          <linearGradient id="slab-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e6ecea" />
          </linearGradient>
          <filter id="lift" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="9"
              floodColor="#18223a"
              floodOpacity="0.16"
            />
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {layers.map((l) => (
          <g key={l.key} filter="url(#lift)">
            <polygon points={l.left} fill="#c9d3d0" />
            <polygon points={l.right} fill="#b5c1be" />
            <polygon points={l.top} fill="url(#slab-top)" stroke="#d2dbd8" strokeWidth="0.8" />
          </g>
        ))}

        {[1, 2, 3].map((f) => {
          const p = iso(-30, 200, f);
          return (
            <text
              key={f}
              x={p.x - 70}
              y={p.y - 30}
              className="fill-ink-soft font-figure text-[11px]"
            >
              Level {f}
            </text>
          );
        })}

        {columns.map(({ s, base, h, color }) => {
          const w = 7;
          const top = { x: base.x, y: base.y - h };
          const l = `${pt({ x: base.x - w, y: base.y - w / 2 })} ${pt({ x: base.x, y: base.y })} ${pt({ x: base.x, y: top.y })} ${pt({ x: top.x - w, y: top.y - w / 2 })}`;
          const r = `${pt({ x: base.x, y: base.y })} ${pt({ x: base.x + w, y: base.y - w / 2 })} ${pt({ x: top.x + w, y: top.y - w / 2 })} ${pt({ x: top.x, y: top.y })}`;
          const cap = `${pt({ x: top.x, y: top.y })} ${pt({ x: top.x + w, y: top.y - w / 2 })} ${pt({ x: top.x, y: top.y - w })} ${pt({ x: top.x - w, y: top.y - w / 2 })}`;
          return (
            <g key={s.id} className="campus-column" style={{ ["--h" as string]: `${h}px` }}>
              <title>{`${s.name}: ${s.count} waiting, about ${Math.round(s.est_wait_min)} min`}</title>
              <polygon points={l} fill={color.side} opacity="0.9" />
              <polygon points={r} fill={color.side} />
              <polygon points={cap} fill={color.top} />
            </g>
          );
        })}

        <path
          d={path}
          fill="none"
          stroke="#0f766e"
          strokeOpacity="0.18"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className={reduced ? undefined : "thread-draw"}
          filter="url(#glow)"
        />
        {!reduced && (
          <circle r="5.5" fill="#ffffff" stroke="#0f766e" strokeWidth="3">
            <animateMotion dur="14s" repeatCount="indefinite" path={path} begin="2.4s" />
          </circle>
        )}

        {busiest.map(({ s, base, h }) => (
          <g key={`label-${s.id}`}>
            <line
              x1={base.x}
              y1={base.y - h - 6}
              x2={base.x + 26}
              y2={base.y - h - 26}
              stroke="#18223a"
              strokeWidth="1"
            />
            <rect
              x={base.x + 26}
              y={base.y - h - 40}
              width={Math.max(84, s.name.length * 6.4 + 40)}
              height="26"
              rx="4"
              fill="#18223a"
            />
            <text
              x={base.x + 34}
              y={base.y - h - 23}
              className="fill-white font-figure text-[12px] font-semibold"
            >
              {s.name} {Math.round(s.est_wait_min)} min
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
