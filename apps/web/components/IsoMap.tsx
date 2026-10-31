"use client";

import { useMemo, useState } from "react";
import type { CampusNode, Zone } from "@throughline/hospital";
import { t, type OpsStation } from "@throughline/shared";
import { campus, node } from "../lib/campus";
import { ZONE_STROKE } from "../lib/zone-classes";
import { QueueSpark } from "./QueueSpark";

/** 2:1 isometric projection; floors are drawn as exploded layers (spec 3.5). */
// Each floor spans about 255 m of (x + y), so layers 215 px apart overlap only at the edges.
const SCALE = 2.0;
const FLOOR_GAP = 215;
const ORIGIN = { x: 330, y: 425 };

export function iso(x: number, y: number, floor: number) {
  return {
    x: ORIGIN.x + (x - y) * SCALE,
    y: ORIGIN.y + (x + y) * SCALE * 0.5 - (floor - 1) * FLOOR_GAP,
  };
}

const at = (n: CampusNode) => iso(n.x, n.y, n.floor);

function diamond(cx: number, cy: number, floor: number, half: number): string {
  return [
    iso(cx - half, cy - half, floor),
    iso(cx + half, cy - half, floor),
    iso(cx + half, cy + half, floor),
    iso(cx - half, cy + half, floor),
  ]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

/** Stations whose label goes to the left, so neighbours (CT and X-ray, the two pods) don't collide. */
const LABEL_LEFT = new Set(["imaging_xray", "clinic_2b", "registration"]);

/** Wait tokens (spec 9.2); the number is always drawn next to the color. */
export function waitFill(minutes: number): string {
  if (minutes >= 20) return "fill-wait-high";
  if (minutes >= 10) return "fill-wait-mid";
  return "fill-wait-low";
}

interface Footprint {
  key: string;
  floor: number;
  points: string;
}

/** Building outlines per floor: the bounding box of that floor's nodes, padded. */
function footprints(): Footprint[] {
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
      const floor = nodes[0]?.floor ?? 1;
      const [x0, x1, y0, y1] = [
        Math.min(...xs) - pad,
        Math.max(...xs) + pad,
        Math.min(...ys) - pad,
        Math.max(...ys) + pad,
      ];
      const pts = [iso(x0, y0, floor), iso(x1, y0, floor), iso(x1, y1, floor), iso(x0, y1, floor)];
      return {
        key,
        floor,
        points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
      };
    })
    .sort((a, b) => a.floor - b.floor);
}

export interface MapRoute {
  /** Node ids along the walking route, in order. */
  nodes: string[];
  /** Where the patient is now. */
  here: string;
}

/**
 * The campus as an isometric SVG: building floors, corridors, stations tinted by wait with the
 * number beside them, waiting areas hatched with their count, and the selected journey drawn
 * as one transit-style line. Decorative for screen readers; the rails carry the same facts.
 */
export function IsoMap({
  stations,
  route,
  onSelectStation,
}: {
  stations: OpsStation[];
  route?: MapRoute;
  onSelectStation?: (id: OpsStation["id"]) => void;
}) {
  const [hover, setHover] = useState<OpsStation | undefined>();
  const outlines = useMemo(footprints, []);

  const edges = campus.edges.map((e) => {
    const a = node(e.a);
    const b = node(e.b);
    return a && b ? { e, a: at(a), b: at(b) } : undefined;
  });

  const routeSegments = (route?.nodes ?? []).slice(1).flatMap((id, i) => {
    const a = node(route?.nodes[i] ?? "");
    const b = node(id);
    if (!a || !b) return [];
    return [{ key: `${a.id}-${b.id}-${i}`, a: at(a), b: at(b), zone: b.zone as Zone }];
  });
  const here = route ? node(route.here) : undefined;

  return (
    <div className="relative h-full w-full">
      <svg
        aria-label={t("en", "ops.map_label")}
        role="img"
        viewBox="0 0 980 740"
        className="h-full w-full"
      >
        <defs>
          <pattern
            id="hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-ink-soft" strokeWidth="1.5" />
          </pattern>
        </defs>

        {[1, 2, 3].map((floor) => {
          const p = iso(60, 60, floor);
          return (
            <text
              key={floor}
              x={24}
              y={p.y}
              className="fill-ink-soft font-display text-[18px] font-semibold"
            >
              {t("en", "ops.level", { floor })}
            </text>
          );
        })}

        {outlines.map((o) => (
          <polygon
            key={o.key}
            points={o.points}
            className="fill-ink/5 stroke-ink/15"
            strokeWidth={1}
          />
        ))}

        {edges.map((x) =>
          x ? (
            <line
              key={`${x.e.a}-${x.e.b}`}
              x1={x.a.x}
              y1={x.a.y}
              x2={x.b.x}
              y2={x.b.y}
              className="stroke-ink/25"
              strokeWidth={x.e.kind === "walk" ? 1.5 : 1}
              strokeDasharray={x.e.kind === "walk" ? undefined : "4 4"}
            />
          ) : null,
        )}

        {campus.waiting_areas.map((w) => {
          const n = node(w.node_id);
          if (!n) return null;
          const count = stations.find((s) => s.waiting_node === w.node_id)?.count ?? 0;
          const p = at(n);
          return (
            <g key={w.node_id}>
              <polygon
                points={diamond(n.x, n.y, n.floor, 6)}
                fill="url(#hatch)"
                className="stroke-ink-soft"
                strokeWidth={1}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="fill-ink font-display text-[13px] font-bold"
              >
                {count}
              </text>
            </g>
          );
        })}

        {routeSegments.map((s) => (
          <line
            key={s.key}
            x1={s.a.x}
            y1={s.a.y}
            x2={s.b.x}
            y2={s.b.y}
            strokeWidth={6}
            strokeLinecap="square"
            className={ZONE_STROKE[s.zone]}
          />
        ))}

        {stations.map((s) => {
          const n = node(s.node_id);
          if (!n) return null;
          const p = at(n);
          return (
            <g
              key={s.id}
              data-station={s.id}
              className="cursor-pointer"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(undefined)}
              onClick={() => onSelectStation?.(s.id)}
            >
              <polygon
                points={diamond(n.x, n.y, n.floor, 7)}
                className={`${waitFill(s.est_wait_min)} stroke-ink`}
                strokeWidth={1.5}
              />
              <text
                x={LABEL_LEFT.has(s.id) ? p.x - 20 : p.x + 20}
                y={LABEL_LEFT.has(s.id) ? p.y + 16 : p.y - 4}
                textAnchor={LABEL_LEFT.has(s.id) ? "end" : "start"}
                className="fill-ink font-display text-[15px] font-semibold"
              >
                {s.name}{" "}
                <tspan className="font-bold tabular-nums">{Math.round(s.est_wait_min)} min</tspan>
              </text>
            </g>
          );
        })}

        {here &&
          (() => {
            const p = at(here);
            return (
              <rect
                x={p.x - 8}
                y={p.y - 8}
                width={16}
                height={16}
                className="fill-line stroke-paper"
                strokeWidth={2}
              />
            );
          })()}
      </svg>

      {hover && (
        <div className="pointer-events-none absolute top-3 right-3 bg-ink px-4 py-3 text-board-text">
          <p className="font-display text-[20px] font-semibold">{hover.name}</p>
          <p className="text-[13px]">
            {t("en", "ops.waiting_count", {
              count: hover.count,
              open: hover.open_servers,
              servers: hover.servers,
            })}
          </p>
          <QueueSpark counts={hover.series} width={180} height={40} className="stroke-board-text" />
        </div>
      )}
    </div>
  );
}
