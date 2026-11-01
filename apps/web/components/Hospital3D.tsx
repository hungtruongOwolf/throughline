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
import type { FloorStation, Site, SiteBuilding, SiteNode } from "@throughline/hospital";
import { useHospital } from "../lib/session";

/**
 * A hospital as a real 3D model (WebGL), drawn from its site: each building with its floors as
 * slabs and glass walls, corridors on the floors and skybridges between buildings, elevator
 * shafts through them, every station as a room with its name and wait, the people waiting in
 * line, and one patient's route through the day. Drag to turn it, scroll to zoom.
 */

const S = 0.26; // metres to scene units
const SLAB = 0.28;
const ZONE: Record<string, string> = {
  blue: "#3b6fd6",
  gold: "#c9971a",
  green: "#3c8c5a",
  rose: "#c2506a",
  violet: "#7c5cbf",
};

interface Frame {
  /** Label size relative to the frame (smaller on phones and on big campuses). */
  label: number;
  /** Space around the campus when it is fitted to the frame. */
  margin: number;
  /** Height of one floor; tall towers are pulled apart less so they still fit. */
  floorH: number;
  cx: number;
  cy: number;
}
const FrameContext = createContext<Frame>({ label: 1, margin: 1, floorH: 7, cx: 0, cy: 0 });

function useFrameMath() {
  const f = useContext(FrameContext);
  return useMemo(
    () => ({
      ...f,
      px: (n: { x: number }) => (n.x - f.cx) * S,
      pz: (n: { y: number }) => (n.y - f.cy) * S,
      py: (floor: number) => (floor - 1) * f.floorH,
    }),
    [f],
  );
}

function waitColor(min: number): string {
  if (min >= 20) return "#d4442d";
  if (min >= 10) return "#e29226";
  return "#2f9e8f";
}

// ---- the route: shortest walk through the site --------------------------------------------

function shortest(site: Site, from: string, to: string): string[] {
  const adj = new Map<string, [string, number][]>();
  for (const e of site.edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), [e.b, e.seconds]]);
    adj.set(e.b, [...(adj.get(e.b) ?? []), [e.a, e.seconds]]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  while (true) {
    let u: string | undefined;
    for (const [id, d] of dist)
      if (!done.has(id) && (u === undefined || d < (dist.get(u) ?? Infinity))) u = id;
    if (!u || u === to) break;
    done.add(u);
    for (const [v, s] of adj.get(u) ?? []) {
      const d = (dist.get(u) ?? 0) + s;
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

// ---- pieces -------------------------------------------------------------------------------

function Building({ b }: { b: SiteBuilding }) {
  const { label, floorH, px, pz, py } = useFrameMath();
  const w = (b.x1 - b.x0) * S;
  const d = (b.y1 - b.y0) * S;
  const cx = px({ x: (b.x0 + b.x1) / 2 });
  const cz = pz({ y: (b.y0 + b.y1) / 2 });
  const levels = Array.from({ length: b.floors - b.lowest + 1 }, (_, i) => b.lowest + i);
  return (
    <group>
      {levels.map((f) => (
        <group key={f} position={[cx, py(f), cz]}>
          <mesh receiveShadow castShadow position={[0, -SLAB / 2, 0]}>
            <boxGeometry args={[w, SLAB, d]} />
            <meshStandardMaterial color={b.parking ? "#d5dbd9" : "#f8faf9"} roughness={0.85} />
            <Edges color={b.parking ? "#9aa5a2" : "#b9c5c1"} />
          </mesh>
          {/* glass walls up to the next floor */}
          {!b.parking && (
            <mesh position={[0, floorH / 2, 0]}>
              <boxGeometry args={[w, floorH - SLAB, d]} />
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
          {b.parking && (
            // the garage's open sides: a low parapet on each level
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[w, 0.7, d]} />
              <meshStandardMaterial color="#c4ccca" transparent opacity={0.25} depthWrite={false} />
              <Edges color="#a9b3b0" />
            </mesh>
          )}
        </group>
      ))}
      {!b.parking && (
        <mesh position={[cx, py(b.floors) + floorH - SLAB / 2, cz]}>
          <boxGeometry args={[w, SLAB * 0.6, d]} />
          <meshStandardMaterial color="#e6ecea" transparent opacity={0.35} depthWrite={false} />
          <Edges color="#b9c5c1" />
        </mesh>
      )}
      {b.name && (
        <Html
          position={[cx, py(b.floors) + floorH + 0.6, cz]}
          center
          distanceFactor={84 * label}
          zIndexRange={[6, 0]}
        >
          <span className="pointer-events-none rounded-[3px] bg-white/90 px-1.5 py-0.5 font-figure text-[13px] font-semibold whitespace-nowrap text-ink shadow-sm select-none">
            {b.name}
            <span className="ml-1 font-normal text-ink-soft">
              {b.floors} {b.parking ? "levels" : "floors"}
            </span>
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
  loudByWait,
  quiet,
  onSelect,
}: {
  n: SiteNode;
  station?: FloorStation | undefined;
  selected: boolean;
  loudByWait: boolean;
  quiet: boolean;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const { label, floorH, px, pz, py } = useFrameMath();
  const box = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const alert = station ? station.est_wait_min >= 20 : false;
  const plain = n.kind === "room";
  useFrame(({ clock }) => {
    const m = box.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m)
      m.emissiveIntensity = alert
        ? 0.35 + Math.sin(clock.elapsedTime * 3) * 0.25
        : hover || selected
          ? 0.25
          : 0;
  });
  const color = alert ? "#d4442d" : (ZONE[n.zone] ?? "#8a9a96");
  const h = Math.min(1.7, floorH * 0.45);
  // A name with its wait for the busiest, selected, or hovered rooms; a quiet name otherwise.
  const loud = selected || hover || loudByWait;
  return (
    <group position={[px(n), py(n.floor), pz(n)]}>
      <RoundedBox
        ref={box}
        args={plain ? [3.6, h * 0.8, 2.4] : [3.4, h, 2.6]}
        radius={Math.min(0.18, h * 0.2)}
        position={[0, (plain ? h * 0.8 : h) / 2, 0]}
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
          transparent={plain}
          opacity={plain ? 0.35 : 1}
        />
      </RoundedBox>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.4, 2.75, 48]} />
          <meshBasicMaterial color="#18223a" />
        </mesh>
      )}
      {loud ? (
        <Html position={[0, h + 0.9, 0]} center distanceFactor={80 * label} zIndexRange={[20, 10]}>
          <span
            className={`pointer-events-none flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-[13px] whitespace-nowrap shadow-lg select-none ${
              selected || alert ? "bg-ink text-white" : "bg-white text-ink"
            }`}
          >
            <span className="font-bold">{station?.name ?? n.label}</span>
            {station ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: waitColor(station.est_wait_min) }}
                />
                {Math.round(station.est_wait_min)} min, {station.count} waiting
              </span>
            ) : (
              <span className="font-normal opacity-75">floor {n.floor}</span>
            )}
          </span>
        </Html>
      ) : (
        quiet && (
          <Html position={[0, h + 0.4, 0]} center distanceFactor={80 * label} zIndexRange={[9, 0]}>
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
function Queue({ at, count, color }: { at: SiteNode; count: number; color: string }) {
  const { px, pz, py } = useFrameMath();
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

function Shafts({ site }: { site: Site }) {
  const { floorH, px, pz, py } = useFrameMath();
  const shafts = useMemo(() => {
    const byXY = new Map<string, SiteNode[]>();
    for (const n of site.nodes.filter((x) => x.kind === "elevator")) {
      const key = `${n.building}-${n.x}-${n.y}`;
      byXY.set(key, [...(byXY.get(key) ?? []), n]);
    }
    return [...byXY.values()].map((ns) => ({
      n: ns[0] as SiteNode,
      lo: Math.min(...ns.map((x) => x.floor)),
      hi: Math.max(...ns.map((x) => x.floor)),
    }));
  }, [site]);
  return (
    <>
      {shafts.map(({ n, lo, hi }) => {
        const h = py(hi) - py(lo) + floorH;
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

/** Corridors as lines on each floor; walks between buildings as glass skybridges. */
function Corridors({ site, nodes }: { site: Site; nodes: Map<string, SiteNode> }) {
  const { floorH, px, pz, py } = useFrameMath();
  const { halls, bridges } = useMemo(() => {
    const halls: THREE.Vector3[] = [];
    const bridges: { key: string; mid: THREE.Vector3; len: number; angle: number }[] = [];
    for (const e of site.edges) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      if (!a || !b || a.floor !== b.floor) continue;
      const y = py(a.floor) + 0.05;
      const pa = new THREE.Vector3(px(a), y, pz(a));
      const pb = new THREE.Vector3(px(b), y, pz(b));
      if (a.building !== b.building && a.kind !== "entrance" && b.kind !== "entrance")
        bridges.push({
          key: `${e.a}-${e.b}`,
          mid: pa.clone().add(pb).multiplyScalar(0.5),
          len: pa.distanceTo(pb),
          angle: Math.atan2(pb.z - pa.z, pb.x - pa.x),
        });
      else halls.push(pa, pb);
    }
    return { halls, bridges };
  }, [site, nodes, px, py, pz]);
  const tube = Math.min(1.1, floorH * 0.4);
  return (
    <>
      {halls.length > 0 && <Line points={halls} segments color="#c3ceca" lineWidth={3} />}
      {bridges.map((b) => (
        <mesh
          key={b.key}
          position={[b.mid.x, b.mid.y + tube / 2, b.mid.z]}
          rotation={[0, -b.angle, 0]}
        >
          <boxGeometry args={[b.len, tube, 1.1]} />
          <meshStandardMaterial color="#7f8ea3" transparent opacity={0.45} />
          <Edges color="#5c6b84" />
        </mesh>
      ))}
    </>
  );
}

function Route({
  site,
  nodes,
  animate,
}: {
  site: Site;
  nodes: Map<string, SiteNode>;
  animate: boolean;
}) {
  const { px, pz, py } = useFrameMath();
  const curve = useMemo(() => {
    const ids: string[] = [];
    for (let i = 1; i < site.day.length; i++) {
      const leg = shortest(site, site.day[i - 1] as string, site.day[i] as string);
      ids.push(...(i === 1 ? leg : leg.slice(1)));
    }
    const pts = ids.map((id) => nodes.get(id)).filter((n): n is SiteNode => !!n);
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as SiteNode;
      const b = pts[i] as SiteNode;
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(px(a), py(a.floor) + 0.55, pz(a)),
          new THREE.Vector3(px(b), py(b.floor) + 0.55, pz(b)),
        ),
      );
    }
    return path;
  }, [site, nodes, px, py, pz]);
  const dot = useRef<THREE.Mesh>(null);
  const tube = useMemo(
    () =>
      curve.curves.length
        ? new THREE.TubeGeometry(curve as unknown as THREE.Curve<THREE.Vector3>, 600, 0.13, 8)
        : undefined,
    [curve],
  );
  useFrame(({ clock }) => {
    if (!dot.current || !tube) return;
    const t = animate ? (clock.elapsedTime / 20) % 1 : 0.42;
    dot.current.position.copy(curve.getPointAt(t));
  });
  if (!tube) return null;
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
  site,
  stations,
  selected,
  onSelect,
  height = 520,
  onReady,
}: {
  site: Site;
  stations: FloorStation[];
  selected?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  height?: number;
  /** Called once the first frame is on screen. */
  onReady?: () => void;
}) {
  const hospital = useHospital();
  const [spin, setSpin] = useState(true);
  // On a phone the page must scroll: the model turns by itself and leaves touches alone.
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = useMemo<Frame>(() => {
    const top = Math.max(...site.buildings.map((b) => b.floors));
    const tall = top > 6;
    return {
      label: (narrow ? 0.7 : 1) * (tall ? 0.75 : 1),
      margin: (narrow ? 1.05 : 0.8) * (tall ? 1.3 : 1),
      floorH: top <= 4 ? 7 : Math.max(2.4, 30 / top),
      cx:
        (Math.min(...site.buildings.map((b) => b.x0)) +
          Math.max(...site.buildings.map((b) => b.x1))) /
        2,
      cy:
        (Math.min(...site.buildings.map((b) => b.y0)) +
          Math.max(...site.buildings.map((b) => b.y1))) /
        2,
    };
  }, [site, narrow]);
  const nodes = useMemo(() => new Map(site.nodes.map((n) => [n.id, n])), [site]);
  const stationAt = useMemo(() => {
    const m = new Map<string, FloorStation>();
    for (const s of stations) m.set(s.node_id, s);
    return m;
  }, [stations]);
  // The four longest waits speak up; with many stations the rest stay quiet until hovered.
  const loudest = useMemo(
    () =>
      new Set(
        [...stations]
          .filter((s) => s.est_wait_min >= 5)
          .sort((a, b) => b.est_wait_min - a.est_wait_min)
          .slice(0, site.stations.length > 12 ? 2 : 4)
          .map((s) => s.id),
      ),
    [stations],
  );
  const crowded = site.stations.length > 12;
  const rooms = site.nodes.filter(
    (n) =>
      n.kind === "station" || n.kind === "entrance" || n.kind === "amenity" || n.kind === "room",
  );
  const width =
    Math.max(...site.buildings.map((b) => b.x1)) - Math.min(...site.buildings.map((b) => b.x0));
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
      aria-label={`${hospital.name} in 3D, ${site.buildings.length} buildings. Longest waits: ${summary}.`}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [38, 52, 52], fov: 30, near: 1, far: 800 }}
        gl={{ antialias: true, alpha: true }}
        onPointerDown={() => setSpin(false)}
        onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      >
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[30, 60, 20]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={70}
          shadow-camera-bottom={-70}
        />
        <hemisphereLight args={["#ffffff", "#cfd8d5", 0.35]} />
        <FrameContext.Provider value={frame}>
          {/* Fits the whole campus to whatever size the frame is; refits when the site changes. */}
          <Bounds key={site.name} fit clip observe margin={frame.margin}>
            <Turntable on={narrow && !reduced}>
              <group position={[0, -2, 0]}>
                {site.buildings.map((b) => (
                  <Building key={b.id} b={b} />
                ))}
                <Corridors site={site} nodes={nodes} />
                <Shafts site={site} />
                {rooms.map((n) => {
                  const station = stationAt.get(n.id);
                  return (
                    <Room
                      key={n.id}
                      n={n}
                      station={station}
                      selected={selected !== undefined && station?.id === selected}
                      loudByWait={!!station && loudest.has(station.id)}
                      quiet={n.kind === "entrance" || (!crowded && !!station)}
                      onSelect={onSelect}
                    />
                  );
                })}
                {stations.map((s) => {
                  const at = nodes.get(s.waiting_node ?? s.node_id);
                  return at && s.count > 0 ? (
                    <Queue key={s.id} at={at} count={s.count} color={waitColor(s.est_wait_min)} />
                  ) : null;
                })}
                <Route site={site} nodes={nodes} animate={!reduced} />
              </group>
            </Turntable>
          </Bounds>
        </FrameContext.Provider>
        <group position={[0, -2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -SLAB - 0.02, 0]} receiveShadow>
            <planeGeometry args={[width * S * 1.6, width * S * 1.2]} />
            <shadowMaterial opacity={0.12} />
          </mesh>
          <ContactShadows
            position={[0, -SLAB - 0.01, 0]}
            opacity={0.25}
            scale={width * S * 1.3}
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
            maxDistance={220}
            maxPolarAngle={1.32}
            target={[0, 5, 0]}
          />
        )}
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[12px] text-ink-soft">
        {narrow ? `${hospital.name}, live` : "Drag to turn, scroll to zoom"}
        {onSelect && !narrow
          ? hospital.forecasts
            ? ", select a room to forecast it"
            : ", select a room to see its wait"
          : ""}
        .
      </p>
    </div>
  );
}
