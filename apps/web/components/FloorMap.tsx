import type { Zone } from "@throughline/hospital";
import { campus, node } from "../lib/campus";
import {
  corridors,
  FLOOR_PLANS,
  floorOf,
  legPoints,
  type Floor,
  type Poi,
  type Rect,
} from "../lib/floorplan";

const ZONE_FILL: Record<Zone, string> = {
  blue: "var(--color-zone-blue)",
  gold: "var(--color-zone-gold)",
  green: "var(--color-zone-green)",
  rose: "var(--color-zone-rose)",
  violet: "var(--color-zone-violet)",
};

const HERE = "#2563eb";

function bounds(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function points(path: [number, number][]): string {
  return path.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Route polyline on one floor: consecutive nodes that are both on it, drawn as hallways. */
function routeOnFloor(nodes: string[], floor: Floor): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1] as string;
    const b = nodes[i] as string;
    if (floorOf(a) === floor && floorOf(b) === floor) {
      const leg = legPoints(a, b);
      run = run.length === 0 ? leg : [...run, ...leg.slice(1)];
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

function PoiIcon({ poi }: { poi: Poi }) {
  const { x, y } = poi;
  const glyph: Record<Poi["kind"], string> = {
    restroom: "WC",
    info: "i",
    elevator: "",
    entrance: "",
    parking: "P",
    cafe: "",
    stairs: "",
  };
  if (poi.kind === "elevator") {
    return (
      <g aria-label={poi.label}>
        <rect x={x - 3} y={y - 3} width={6} height={6} rx={1} fill="var(--color-ink)" />
        <path d={`M${x - 1.6} ${y - 0.4} L${x} ${y - 2.2} L${x + 1.6} ${y - 0.4} Z`} fill="white" />
        <path d={`M${x - 1.6} ${y + 0.4} L${x} ${y + 2.2} L${x + 1.6} ${y + 0.4} Z`} fill="white" />
      </g>
    );
  }
  if (poi.kind === "stairs") {
    return (
      <g aria-label={poi.label}>
        <rect x={x - 3} y={y - 3} width={6} height={6} rx={1} fill="#9aa3ad" />
        <path
          d={`M${x - 2} ${y + 2} h1.4 v-1.3 h1.3 v-1.3 h1.3 v-1.3 h0.8`}
          stroke="white"
          strokeWidth={0.6}
          fill="none"
        />
      </g>
    );
  }
  if (poi.kind === "entrance") {
    return (
      <g aria-label={poi.label}>
        <rect x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1} fill="var(--color-line)" />
        <path
          d={`M${x - 1.8} ${y} h3 M${x + 0.2} ${y - 1.5} l1.5 1.5 l-1.5 1.5`}
          stroke="white"
          strokeWidth={0.7}
          fill="none"
        />
      </g>
    );
  }
  return (
    <g aria-label={poi.label}>
      <circle
        cx={x}
        cy={y}
        r={3}
        fill={poi.kind === "parking" ? "#3b6fd6" : "var(--color-ink-soft)"}
      />
      <text
        x={x}
        y={y + 1.1}
        textAnchor="middle"
        fontSize={poi.kind === "restroom" ? 2.4 : 3.2}
        fontWeight={700}
        fill="white"
      >
        {glyph[poi.kind]}
      </text>
    </g>
  );
}

/**
 * A flat floor plan of one level (UX research: real hospital apps lead with 2D per level,
 * not 3D). Hallways come from the walking graph; the route is drawn on them in the line
 * color; "you are here" is a blue dot; the destination is a pin. `focus` crops the view to
 * the route on this floor so labels stay readable on a phone.
 */
export function FloorMap({
  floor,
  routeNodes = [],
  here,
  destination,
  focus = false,
  minView = { w: 110, h: 80 },
  onFloorChange,
  className,
}: {
  floor: Floor;
  routeNodes?: string[];
  here?: string;
  destination?: string;
  focus?: boolean;
  /** Smallest area shown when focused, in campus units; also sets the map's aspect ratio. */
  minView?: { w: number; h: number };
  onFloorChange?: (floor: Floor) => void;
  className?: string;
}) {
  const plan = FLOOR_PLANS[floor];
  const full = bounds(plan.buildings);
  const onFloor = routeNodes.filter((id) => floorOf(id) === floor);
  let view = { x: full.x - 6, y: full.y - 6, w: full.w + 12, h: full.h + 12 };
  if (focus && onFloor.length > 0) {
    const pts = onFloor.map((id) => node(id)).filter((n) => n !== undefined);
    const box = bounds(pts.map((n) => ({ x: n.x, y: n.y, w: 0, h: 0 })));
    const w = Math.max(minView.w, box.w + 40, ((box.h + 40) * minView.w) / minView.h);
    const h = (w * minView.h) / minView.w;
    view = { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
  }
  const runs = routeOnFloor(routeNodes, floor);
  // Where the route leaves this floor: a pill at the elevator that switches the map.
  const exits: { at: string; to: Floor; label: string }[] = [];
  for (let i = 1; i < routeNodes.length; i++) {
    const a = routeNodes[i - 1] as string;
    const b = routeNodes[i] as string;
    const fa = floorOf(a);
    const fb = floorOf(b);
    if (fa === floor && fb !== undefined && fb !== floor) {
      exits.push({ at: a, to: fb, label: `Continue on Level ${fb}` });
    }
  }
  const hereNode = here && floorOf(here) === floor ? node(here) : undefined;
  const destNode = destination && floorOf(destination) === floor ? node(destination) : undefined;
  const stations = campus.nodes.filter(
    (n) =>
      n.floor === floor && n.kind === "station" && !plan.rooms.some((r) => r.label === n.label),
  );

  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      role="img"
      aria-label={`Level ${floor} floor plan`}
      className={className}
      style={{ fontFamily: "var(--font-text)" }}
    >
      <defs>
        <pattern
          id="garage"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="4" height="4" fill="#e9ece8" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="#d6dad4" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#e8ebe5" />

      {plan.buildings.map((b) => (
        <g key={b.id}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={b.kind === "building" ? 2 : 1}
            fill={b.kind === "garage" ? "url(#garage)" : b.kind === "link" ? "#f1f3ef" : "#fbfbf9"}
            stroke="#b9c0c7"
            strokeWidth={b.kind === "building" ? 0.8 : 0.5}
            strokeDasharray={b.kind === "link" ? "1.5 1" : undefined}
          />
          {b.kind !== "link" && (
            <text x={b.x + 2} y={b.y + b.h - 2} fontSize={2.8} fill="#7b8592" fontWeight={700}>
              {b.label.toUpperCase()}
            </text>
          )}
        </g>
      ))}

      {corridors(floor).map(([a, b]) => (
        <polyline
          key={`${a}-${b}`}
          points={points(legPoints(a, b))}
          fill="none"
          stroke="#e3e6e1"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {plan.rooms.map((r) => (
        <g key={r.label}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={1.2}
            fill={r.zone ? ZONE_FILL[r.zone] : "#dfe3e8"}
            fillOpacity={r.zone ? (r.kind === "lobby" ? 0.1 : 0.18) : 0.7}
            stroke={r.zone ? ZONE_FILL[r.zone] : "#c3c9d0"}
            strokeWidth={0.5}
          />
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h - 1.8}
            textAnchor="middle"
            fontSize={3}
            fontWeight={700}
            fill="var(--color-ink)"
          >
            {r.label}
          </text>
        </g>
      ))}

      {stations.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={1.1} fill="var(--color-ink-soft)" />
          <text x={n.x + 1.8} y={n.y + 1} fontSize={2.5} fill="var(--color-ink-soft)">
            {n.label}
          </text>
        </g>
      ))}

      {plan.pois.map((p) => (
        <PoiIcon key={`${p.kind}-${p.x}-${p.y}`} poi={p} />
      ))}

      {runs.map((run, i) => (
        <g key={i}>
          <polyline
            points={points(run)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={points(run)}
            fill="none"
            stroke="white"
            strokeWidth={0.7}
            strokeDasharray="1.2 2.8"
            strokeLinecap="round"
            className="route-flow"
          />
        </g>
      ))}

      {exits.map((e) => {
        const n = node(e.at);
        if (!n) return null;
        const w = 30;
        return (
          <g
            key={e.at}
            role={onFloorChange ? "button" : undefined}
            tabIndex={onFloorChange ? 0 : undefined}
            onClick={() => onFloorChange?.(e.to)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") onFloorChange?.(e.to);
            }}
            style={{ cursor: onFloorChange ? "pointer" : undefined }}
          >
            <rect
              x={n.x - w / 2}
              y={n.y - 11}
              width={w}
              height={6}
              rx={3}
              fill="var(--color-ink)"
            />
            <text
              x={n.x}
              y={n.y - 7}
              textAnchor="middle"
              fontSize={2.8}
              fontWeight={700}
              fill="white"
            >
              {e.label}
            </text>
          </g>
        );
      })}

      {destNode && (
        <g>
          <path
            d={`M${destNode.x} ${destNode.y} c-1.5 -2.5 -4 -4.2 -4 -6.8 a4 4 0 0 1 8 0 c0 2.6 -2.5 4.3 -4 6.8 z`}
            fill="#c2410c"
            stroke="white"
            strokeWidth={0.5}
          />
          <circle cx={destNode.x} cy={destNode.y - 6.8} r={1.4} fill="white" />
        </g>
      )}

      {hereNode && (
        <g>
          <circle
            cx={hereNode.x}
            cy={hereNode.y}
            r={5}
            fill={HERE}
            fillOpacity={0.18}
            className="here-pulse"
          />
          <circle
            cx={hereNode.x}
            cy={hereNode.y}
            r={2}
            fill={HERE}
            stroke="white"
            strokeWidth={0.7}
          />
        </g>
      )}
    </svg>
  );
}
