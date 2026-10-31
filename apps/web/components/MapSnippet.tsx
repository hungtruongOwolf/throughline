import type { RouteStep } from "@throughline/shared";
import { node } from "../lib/campus";
import { ZONE_STROKE } from "../lib/zone-classes";

const LANDMARK_KINDS = new Set(["elevator", "junction", "door", "bridge", "walkway", "lobby"]);

/**
 * The phone map snippet (spec 3.5 mode 2): one simplified corridor from "you are here" to the
 * next stop with up to three landmarks. Decorative: the numbered steps are the accessible text.
 */
export function MapSnippet({
  from,
  steps,
  youAreHere,
}: {
  from: string;
  steps: RouteStep[];
  youAreHere: string;
}) {
  // An elevator ride passes two "Elevator A" nodes; show each landmark name once.
  const landmarks = steps
    .slice(0, -1)
    .filter((s) => LANDMARK_KINDS.has(node(s.to_node_id)?.kind ?? ""))
    .filter((s, i, all) => all.findIndex((x) => x.to_label === s.to_label) === i)
    .slice(0, 3);
  const last = steps[steps.length - 1];
  const points = [
    { id: from, label: youAreHere },
    ...landmarks.map((s) => ({ id: s.to_node_id, label: s.to_label })),
    ...(last ? [{ id: last.to_node_id, label: last.to_label }] : []),
  ];
  const gap = 56;
  const height = 24 + (points.length - 1) * gap + 24;
  return (
    <svg aria-hidden viewBox={`0 0 340 ${height}`} className="w-full" role="presentation">
      {points.slice(1).map((p, i) => {
        const zone = node(p.id)?.zone ?? "blue";
        return (
          <line
            key={`seg-${p.id}`}
            x1={24}
            x2={24}
            y1={24 + i * gap}
            y2={24 + (i + 1) * gap}
            strokeWidth={6}
            className={ZONE_STROKE[zone]}
          />
        );
      })}
      {points.map((p, i) => {
        const y = 24 + i * gap;
        const end = i === points.length - 1;
        const size = i === 0 || end ? 16 : 10;
        return (
          <g key={`pt-${p.id}-${i}`}>
            <rect
              x={24 - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              className={i === 0 ? "fill-line" : end ? "fill-ink" : "fill-paper stroke-ink"}
              strokeWidth={i === 0 || end ? 0 : 2}
            />
            <text x={48} y={y + 6} className="fill-ink font-display text-[20px] font-semibold">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
