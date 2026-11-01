"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Edges,
  Html,
  Line,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { CampusNode } from "@throughline/hospital";
import type { OpsStation } from "@throughline/shared";
import { campus, node } from "../lib/campus";

/**
 * Halden Medical Center as a real 3D model (WebGL): each building with its floors as slabs
 * and glass walls, corridors and bridges on the floors, elevator shafts through them, every
 * station as a room with its name and wait, the people waiting in line, and one patient's
 * route through the day. Drag to turn it, scroll to zoom.
 */

const S = 0.26; // metres to scene units
const FLOOR_H = 7; // floors pulled apart (an exploded view) so each level reads
const SLAB = 0.28;
const CENTER = { x: 120, y: 55 };
const ZONE: Record<string, string> = {
  blue: "#3b6fd6",
  gold: "#c9971a",
  green: "#3c8c5a",
  rose: "#c2506a",
  violet: "#7c5cbf",
};
const BUILDING_NAME: Record<string, string> = {
  MP: "Main Pavilion",
  CC: "Cancer Center",
  G: "Garage A",
};

/** Label size relative to the frame (smaller on phones). */
const LabelScale = createContext(1);

const px = (n: { x: number }) => (n.x - CENTER.x) * S;
const pz = (n: { y: number }) => (n.y - CENTER.y) * S;
const py = (floor: number) => (floor - 1) * FLOOR_H;

function waitColor(min: number): string {
  if (min >= 20) return "#d4442d";
  if (min >= 10) return "#e29226";
  return "#2f9e8f";
}

// ---- the route: shortest walk through the campus graph -----------------------------------

function shortest(from: string, to: string): string[] {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set(campus.nodes.map((n) => n.id));
  while (open.size) {
    let u: string | undefined;
    for (const id of open)
      if (dist.has(id) && (u === undefined || (dist.get(id) ?? 0) < (dist.get(u) ?? 0))) u = id;
    if (!u || u === to) break;
    open.delete(u);
    for (const e of campus.edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : undefined;
      if (!v || !open.has(v)) continue;
      const d = (dist.get(u) ?? 0) + e.seconds;
      if (d < (dist.get(v) ?? Infinity)) {
        dist.set(v, d);
        prev.set(v, u);
      }
    }
  }
  const path = [to];
  while (path[0] !== from && prev.has(path[0] as string))
    path.unshift(prev.get(path[0] as string) as string);
  return path[0] === from ? path : [from, to];
}

const DAY = ["mp1.entrance", "lab_draw", "vitals", "imaging_ct", "clinic_2a", "infusion"];

function stationNode(id: string): CampusNode | undefined {
  if (id.includes(".")) return node(id);
  return node(campus.stations.find((s) => s.id === id)?.nodes[0] ?? "");
}

function routeCurve(): THREE.CurvePath<THREE.Vector3> {
  const stops = DAY.map(stationNode).filter((n): n is CampusNode => !!n);
  const ids: string[] = [];
  for (let i = 1; i < stops.length; i++) {
    const leg = shortest((stops[i - 1] as CampusNode).id, (stops[i] as CampusNode).id);
    ids.push(...(i === 1 ? leg : leg.slice(1)));
  }
  const pts = ids.map((id) => node(id)).filter((n): n is CampusNode => !!n);
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as CampusNode;
    const b = pts[i] as CampusNode;
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(px(a), py(a.floor) + 0.55, pz(a)),
        new THREE.Vector3(px(b), py(b.floor) + 0.55, pz(b)),
      ),
    );
  }
  return path;
}

// ---- pieces -------------------------------------------------------------------------------

function Building({ id, nodes }: { id: string; nodes: CampusNode[] }) {
  const scale = useContext(LabelScale);
  const pad = 9;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const [x0, x1, y0, y1] = [
    Math.min(...xs) - pad,
    Math.max(...xs) + pad,
    Math.min(...ys) - pad,
    Math.max(...ys) + pad,
  ];
  const w = (x1 - x0) * S;
  const d = (y1 - y0) * S;
  const cx = ((x0 + x1) / 2 - CENTER.x) * S;
  const cz = ((y0 + y1) / 2 - CENTER.y) * S;
  const floors = [...new Set(nodes.map((n) => n.floor))].sort();
  const top = Math.max(...floors);
  const bottom = Math.min(...floors);
  const garage = id === "G" || id === "GL";
  return (
    <group>
      {Array.from({ length: top - bottom + 1 }, (_, i) => bottom + i).map((f) => (
        <group key={f} position={[cx, py(f), cz]}>
          <mesh receiveShadow castShadow position={[0, -SLAB / 2, 0]}>
            <boxGeometry args={[w, SLAB, d]} />
            <meshStandardMaterial color={garage ? "#d5dbd9" : "#f8faf9"} roughness={0.85} />
            <Edges color={garage ? "#9aa5a2" : "#b9c5c1"} />
          </mesh>
          {/* glass walls up to the next floor */}
          {!garage && (
            <mesh position={[0, FLOOR_H / 2, 0]}>
              <boxGeometry args={[w, FLOOR_H - SLAB, d]} />
              <meshStandardMaterial
                color="#cfe9e4"
                transparent
                opacity={0.045}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
              <Edges color="#d6e1de" />
            </mesh>
          )}
        </group>
      ))}
      {!garage && (
        <mesh position={[cx, py(top) + FLOOR_H - SLAB / 2, cz]}>
          <boxGeometry args={[w, SLAB * 0.6, d]} />
          <meshStandardMaterial color="#e6ecea" transparent opacity={0.35} depthWrite={false} />
          <Edges color="#b9c5c1" />
        </mesh>
      )}
      {BUILDING_NAME[id] && (
        <Html
          position={[cx, py(top) + FLOOR_H + 0.6, cz]}
          center
          distanceFactor={84 * scale}
          zIndexRange={[6, 0]}
        >
          <span className="pointer-events-none rounded-[3px] bg-white/90 px-1.5 py-0.5 font-figure text-[13px] font-semibold whitespace-nowrap text-ink shadow-sm select-none">
            {BUILDING_NAME[id]}
          </span>
        </Html>
      )}
    </group>
  );
}

function Room({
  n,
  station,
  selected,
  onSelect,
}: {
  n: CampusNode;
  station?: OpsStation | undefined;
  selected: boolean;
  onSelect?: ((id: OpsStation["id"]) => void) | undefined;
}) {
  const scale = useContext(LabelScale);
  const box = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const alert = station ? station.est_wait_min >= 20 : false;
  useFrame(({ clock }) => {
    const m = box.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m)
      m.emissiveIntensity = alert
        ? 0.35 + Math.sin(clock.elapsedTime * 3) * 0.25
        : hover || selected
          ? 0.25
          : 0;
  });
  const color = alert ? "#d4442d" : (ZONE[n.zone ?? ""] ?? "#8a9a96");
  // A name with its wait for busy, selected, or hovered rooms; a quiet name otherwise.
  const loud = selected || hover || (station ? station.est_wait_min >= 5 : false);
  return (
    <group position={[px(n), py(n.floor), pz(n)]}>
      <RoundedBox
        ref={box}
        args={[3.4, 1.7, 2.6]}
        radius={0.18}
        position={[0, 0.85, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          if (onSelect && station) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelect && station) onSelect(station.id);
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0}
          roughness={0.55}
        />
      </RoundedBox>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.4, 2.75, 48]} />
          <meshBasicMaterial color="#18223a" />
        </mesh>
      )}
      {loud ? (
        <Html position={[0, 2.6, 0]} center distanceFactor={80 * scale} zIndexRange={[20, 10]}>
          <span
            className={`pointer-events-none flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-[13px] whitespace-nowrap shadow-lg select-none ${
              selected || alert ? "bg-ink text-white" : "bg-white text-ink"
            }`}
          >
            <span className="font-bold">{station?.name ?? n.label}</span>
            {station && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: waitColor(station.est_wait_min) }}
                />
                {Math.round(station.est_wait_min)} min, {station.count} waiting
              </span>
            )}
          </span>
        </Html>
      ) : (
        (station || n.kind === "entrance") && (
          <Html position={[0, 2.1, 0]} center distanceFactor={80 * scale} zIndexRange={[9, 0]}>
            <span className="pointer-events-none text-[11px] font-bold whitespace-nowrap text-ink/75 select-none [text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_3px_#fff]">
              {station?.name ?? n.label}
            </span>
          </Html>
        )
      )}
    </group>
  );
}

/** The people waiting at a station, standing in rows by its waiting area. */
function Queue({ at, count, color }: { at: CampusNode; count: number; color: string }) {
  const people = Math.min(18, Math.round(count));
  return (
    <group position={[px(at) + 2.4, py(at.floor), pz(at) - 1.2]}>
      {Array.from({ length: people }, (_, i) => (
        <group key={i} position={[(i % 6) * 0.62, 0, Math.floor(i / 6) * 0.7]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.42, 4, 10]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.92, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#e9d3bf" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Shafts() {
  const shafts = useMemo(() => {
    const byXY = new Map<string, CampusNode[]>();
    for (const n of campus.nodes.filter((x) => x.kind === "elevator")) {
      const key = `${n.building}-${n.x}-${n.y}`;
      byXY.set(key, [...(byXY.get(key) ?? []), n]);
    }
    return [...byXY.values()].map((ns) => ({
      n: ns[0] as CampusNode,
      lo: Math.min(...ns.map((x) => x.floor)),
      hi: Math.max(...ns.map((x) => x.floor)),
    }));
  }, []);
  return (
    <>
      {shafts.map(({ n, lo, hi }) => {
        const h = py(hi) - py(lo) + FLOOR_H;
        return (
          <mesh key={n.id} position={[px(n), py(lo) + h / 2, pz(n)]} castShadow>
            <boxGeometry args={[1.3, h, 1.3]} />
            <meshStandardMaterial color="#5c6b84" transparent opacity={0.55} />
            <Edges color="#3f4b60" />
          </mesh>
        );
      })}
    </>
  );
}

function Corridors() {
  const lines = useMemo(
    () =>
      campus.edges.flatMap((e) => {
        const a = node(e.a);
        const b = node(e.b);
        if (!a || !b || a.floor !== b.floor) return [];
        const y = py(a.floor) + 0.05;
        return [
          {
            key: `${e.a}-${e.b}`,
            bridge: a.building !== b.building,
            pts: [new THREE.Vector3(px(a), y, pz(a)), new THREE.Vector3(px(b), y, pz(b))],
          },
        ];
      }),
    [],
  );
  return (
    <>
      {lines.map((l) => (
        <Line
          key={l.key}
          points={l.pts}
          color={l.bridge ? "#7f8ea3" : "#c3ceca"}
          lineWidth={l.bridge ? 5 : 3.5}
        />
      ))}
    </>
  );
}

function Route({ animate }: { animate: boolean }) {
  const curve = useMemo(routeCurve, []);
  const dot = useRef<THREE.Mesh>(null);
  const tube = useMemo(
    () =>
      new THREE.TubeGeometry(curve as unknown as THREE.Curve<THREE.Vector3>, 400, 0.13, 8, false),
    [curve],
  );
  useFrame(({ clock }) => {
    if (!dot.current) return;
    const t = animate ? (clock.elapsedTime / 16) % 1 : 0.42;
    dot.current.position.copy(curve.getPointAt(t));
  });
  return (
    <>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#0f766e" emissive="#0f766e" emissiveIntensity={0.45} />
      </mesh>
      <mesh ref={dot} castShadow>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#0f766e" emissiveIntensity={0.25} />
      </mesh>
    </>
  );
}

/** Turns its children slowly (phones, where the controls stay off so the page can scroll). */
function Turntable({ on, children }: { on: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (on && g.current) g.current.rotation.y += dt * 0.08;
  });
  return <group ref={g}>{children}</group>;
}

// ---- the scene ----------------------------------------------------------------------------

export default function Hospital3D({
  stations,
  selected,
  onSelect,
  height = 520,
}: {
  stations: OpsStation[];
  selected?: string | undefined;
  onSelect?: ((id: OpsStation["id"]) => void) | undefined;
  height?: number;
}) {
  const [spin, setSpin] = useState(true);
  // On a phone the page must scroll: the model turns by itself and leaves touches alone.
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buildings = useMemo(() => {
    const m = new Map<string, CampusNode[]>();
    for (const n of campus.nodes) m.set(n.building, [...(m.get(n.building) ?? []), n]);
    return [...m.entries()];
  }, []);
  const stationAt = useMemo(() => {
    const m = new Map<string, OpsStation>();
    for (const s of stations) m.set(s.node_id, s);
    return m;
  }, [stations]);
  const rooms = campus.nodes.filter(
    (n) => n.kind === "station" || n.kind === "entrance" || n.kind === "amenity",
  );
  const summary = [...stations]
    .sort((a, b) => b.est_wait_min - a.est_wait_min)
    .slice(0, 3)
    .map((s) => `${s.name} ${Math.round(s.est_wait_min)} minutes`)
    .join(", ");
  return (
    <div
      style={{
        height: narrow ? Math.min(height, 360) : height,
        touchAction: narrow ? "pan-y" : "none",
      }}
      className="relative"
      role="img"
      aria-label={`Halden Medical Center in 3D. Longest waits: ${summary}.`}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [38, 52, 52], fov: 30, near: 1, far: 500 }}
        gl={{ antialias: true, alpha: true }}
        onPointerDown={() => setSpin(false)}
      >
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[30, 50, 20]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />
        <hemisphereLight args={["#ffffff", "#cfd8d5", 0.35]} />
        {/* Fits the whole campus to whatever size the frame is. */}
        <LabelScale.Provider value={narrow ? 0.7 : 1}>
          <Bounds fit clip observe margin={narrow ? 1.05 : 0.78}>
            <Turntable on={narrow && !reduced}>
              <group position={[0, -2, 0]}>
                {buildings.map(([id, ns]) => (
                  <Building key={id} id={id} nodes={ns} />
                ))}
                <Corridors />
                <Shafts />
                {rooms.map((n) => (
                  <Room
                    key={n.id}
                    n={n}
                    station={stationAt.get(n.id)}
                    selected={selected !== undefined && stationAt.get(n.id)?.id === selected}
                    onSelect={onSelect}
                  />
                ))}
                {stations.map((s) => {
                  const at = node(s.waiting_node ?? s.node_id);
                  return at && s.count > 0 ? (
                    <Queue key={s.id} at={at} count={s.count} color={waitColor(s.est_wait_min)} />
                  ) : null;
                })}
                <Route animate={!reduced} />
              </group>
            </Turntable>
          </Bounds>
        </LabelScale.Provider>
        <group position={[0, -2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -SLAB - 0.02, 0]} receiveShadow>
            <planeGeometry args={[160, 120]} />
            <shadowMaterial opacity={0.12} />
          </mesh>
          <ContactShadows
            position={[0, -SLAB - 0.01, 0]}
            opacity={0.25}
            scale={120}
            blur={2.5}
            far={20}
          />
        </group>
        {!narrow && (
          <OrbitControls
            makeDefault
            enableDamping
            enablePan={false}
            autoRotate={spin && !reduced}
            autoRotateSpeed={0.45}
            minDistance={30}
            maxDistance={140}
            maxPolarAngle={1.32}
            target={[0, 5, 0]}
          />
        )}
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[12px] text-ink-soft">
        {narrow ? "Halden Medical Center, live" : "Drag to turn, scroll to zoom"}
        {onSelect && !narrow ? ", select a room to forecast it" : ""}.
      </p>
    </div>
  );
}
