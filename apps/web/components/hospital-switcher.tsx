"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Hospital } from "@throughline/shared";
import { useHospitals } from "../lib/session";

/**
 * Which hospital this workspace is for. Throughline serves many hospitals; each one is a
 * workspace. New hospitals join through Add your hospital.
 */

function size(h: Hospital): string {
  if (!h.buildings) return h.status === "live" ? (h.city ?? "") : "Campus not mapped yet";
  return `${h.buildings} building${h.buildings > 1 ? "s" : ""}, up to ${h.floors} floors`;
}

export function HospitalSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { hospital: current, list, choose, refresh } = useHospitals();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    refresh();
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open, refresh]);
  const dark = tone === "dark";
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex max-w-full items-center gap-1.5 rounded-[4px] px-2 py-1 text-[14px] ${
          dark ? "text-white/80 hover:bg-white/10" : "text-ink-soft hover:bg-panel"
        }`}
      >
        <span className="truncate">{current.name}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 w-[300px] rounded-[8px] border border-rule bg-panel py-1 text-ink shadow-lg ${
            dark ? "bottom-full mb-1" : ""
          }`}
        >
          <p className="px-3 pt-1 pb-1.5 text-[12px] font-bold text-ink-soft">Switch hospital</p>
          {list.map((h) => (
            <button
              key={h.id}
              type="button"
              role="menuitemradio"
              aria-checked={h.id === current.id}
              onClick={() => {
                choose(h.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[14px] hover:bg-canvas ${
                h.id === current.id ? "bg-agent-tint font-bold" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{h.name}</span>
                <span className="block text-[12px] font-normal text-ink-soft">
                  {h.city ? `${h.city}, ` : ""}
                  {size(h)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold ${
                  h.status === "live" ? "bg-agent-tint text-agent" : "bg-staff-bg text-staff"
                }`}
              >
                {h.status === "live" ? "Live" : "Setting up"}
              </span>
            </button>
          ))}
          <Link
            href="/setup"
            role="menuitem"
            className="mt-1 block border-t border-rule px-3 py-2 text-[14px] font-bold text-agent hover:bg-canvas"
          >
            Add your hospital
          </Link>
        </div>
      )}
    </div>
  );
}

/** The hospitals side by side, for choosing which campus to look at. */
export function HospitalPicker() {
  const { hospital: current, list, choose } = useHospitals();
  if (list.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Hospital" className="mt-5 flex flex-wrap gap-2">
      {list.map((h) => (
        <button
          key={h.id}
          type="button"
          role="radio"
          aria-checked={h.id === current.id}
          onClick={() => choose(h.id)}
          className={`rounded-[4px] border-2 px-3 py-2 text-left transition-colors ${
            h.id === current.id
              ? "border-ink bg-ink text-white"
              : "border-rule bg-panel text-ink hover:border-ink/40"
          }`}
        >
          <span className="block text-[14px] font-bold">{h.name}</span>
          <span
            className={`block text-[12px] ${h.id === current.id ? "text-white/75" : "text-ink-soft"}`}
          >
            {size(h)}
          </span>
        </button>
      ))}
      <Link
        href="/setup"
        className="flex items-center rounded-[4px] border-2 border-dashed border-rule px-3 py-2 text-[14px] font-bold text-agent hover:border-agent"
      >
        Add your hospital
      </Link>
    </div>
  );
}
