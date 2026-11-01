"use client";

import { useEffect, useState } from "react";
import type { FloorStation, Site } from "@throughline/hospital";
import { RUNTIME_URL } from "./runtime";
import { useHospital, useStream } from "./session";

/** The chosen hospital's site: buildings, floors, rooms. Undefined until mapped or loaded. */
export function useSite(): { site: Site | undefined; missing: boolean } {
  const { id } = useHospital();
  const [site, setSite] = useState<{ id: string; site: Site | undefined }>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void fetch(`${RUNTIME_URL}/api/hospitals/${id}/site`)
      .then((r) => (r.ok ? (r.json() as Promise<Site>) : undefined))
      .then((s) => alive && setSite({ id, site: s }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);
  const current = site?.id === id ? site : undefined;
  return { site: current?.site, missing: !!current && !current.site };
}

/** Who is waiting where in the chosen hospital, refreshed with the live stream and each minute. */
export function useFloor(): FloorStation[] {
  const { id } = useHospital();
  const { version } = useStream();
  const [minute, setMinute] = useState(0);
  const [floor, setFloor] = useState<{ id: string; stations: FloorStation[] }>();
  useEffect(() => {
    const t = setInterval(() => setMinute((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void fetch(`${RUNTIME_URL}/api/hospitals/${id}/floor`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<FloorStation[]>) : []))
      .then((stations) => alive && setFloor({ id, stations }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, version, minute]);
  return floor?.id === id ? floor.stations : [];
}
