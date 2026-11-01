"use client";

import Link from "next/link";
import { useHospital } from "../lib/session";

export const NAV = [{ href: "/map", label: "Find your way" }] as const;

/** One header for every staff and judge surface, so people always know where they are. */
export function SiteHeader({ current }: { current?: (typeof NAV)[number]["href"] | "/" }) {
  const hospital = useHospital();
  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-current={current === "/" ? "page" : undefined}
        >
          <span aria-hidden className="block h-[6px] w-6 bg-line" />
          <span className="font-display text-[22px] font-bold">Throughline</span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              className={
                current === n.href
                  ? "font-bold text-ink underline decoration-line decoration-[3px] underline-offset-8"
                  : "text-ink-soft hover:text-ink"
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-[13px] text-ink-soft">{hospital.name}</span>
      </div>
    </header>
  );
}
