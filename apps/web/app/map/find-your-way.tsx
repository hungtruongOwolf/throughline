"use client";

import { useState } from "react";
import { Wayfinding } from "../../components/Wayfinding";
import { DESTINATIONS } from "../../lib/floorplan";

const START_POINTS = DESTINATIONS.filter((d) =>
  ["mp1.entrance", "g2.parking", "cc1.lobby", "mp1.lobby"].includes(d.id),
);

/** Visitors pick where they are and where they need to be; the route is step-free by default. */
export function FindYourWay() {
  const [from, setFrom] = useState("mp1.entrance");
  const [to, setTo] = useState("mp2.imaging_wait");
  const select =
    "mt-1 block min-h-12 w-full rounded-[12px] bg-white px-3 text-[17px] ring-1 ring-ink/15";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[15px] font-bold">
          I&apos;m at
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={select}>
            {START_POINTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} (Level {d.floor})
              </option>
            ))}
          </select>
        </label>
        <label className="text-[15px] font-bold">
          I need to get to
          <select value={to} onChange={(e) => setTo(e.target.value)} className={select}>
            {DESTINATIONS.filter((d) => d.id !== from).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} (Level {d.floor})
              </option>
            ))}
          </select>
        </label>
      </div>
      <Wayfinding from={from} to={to} layout="wide" />
    </div>
  );
}
