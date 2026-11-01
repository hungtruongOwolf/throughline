"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Hospital } from "@throughline/shared";
import { RUNTIME_URL } from "../lib/runtime";
import { useHospital } from "../lib/session";

/**
 * Which hospital this workspace is for. Throughline serves many hospitals; each one is a
 * workspace. New hospitals join through Add your hospital.
 */
export function HospitalSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const current = useHospital();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Hospital[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    void fetch(`${RUNTIME_URL}/api/hospitals`)
      .then((r) => (r.ok ? (r.json() as Promise<Hospital[]>) : []))
      .then(setList)
      .catch(() => undefined);
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
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
          className={`absolute z-40 mt-1 w-[280px] rounded-[8px] border border-rule bg-panel py-1 text-ink shadow-lg ${
            dark ? "bottom-full mb-1" : ""
          }`}
        >
          <p className="px-3 pt-1 pb-1.5 text-[12px] font-bold text-ink-soft">
            Hospitals on Throughline
          </p>
          {list.map((h) => (
            <div
              key={h.id}
              role="menuitem"
              aria-current={h.id === current.id ? "true" : undefined}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-[14px] ${
                h.id === current.id ? "bg-agent-tint font-bold" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{h.name}</span>
                <span className="block text-[12px] font-normal text-ink-soft">
                  {h.specialties.join(", ")}
                  {h.city ? `, ${h.city}` : ""}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold ${
                  h.status === "live" ? "bg-agent-tint text-agent" : "bg-staff-bg text-staff"
                }`}
              >
                {h.status === "live" ? "Live" : "Setting up"}
              </span>
            </div>
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
