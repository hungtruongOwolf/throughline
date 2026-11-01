"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { agentProfile, STAFF, type JourneyRow } from "@throughline/shared";
import { fetchHospital, fetchReferrals } from "../lib/platform";
import { useLive, useStream, useUser } from "../lib/session";
import { NewReferralDialog } from "./new-referral";
import { AgentGlyph, Avatar, Drawer, hhmm, shortDate } from "./ui";

// ---- getting started ----------------------------------------------------------------------

const STEPS_KEY = "tl_started";
export type StartStep = "fax" | "insurance" | "floor" | "patient";
const STEPS: { id: StartStep; text: string }[] = [
  { id: "fax", text: "Receive a referral" },
  { id: "insurance", text: "Approve an insurance submission" },
  { id: "floor", text: "Approve a change on today's floor" },
  { id: "patient", text: "See what the patient sees" },
];

function readSteps(): { done: StartStep[]; hidden: boolean } {
  try {
    return JSON.parse(window.localStorage.getItem(STEPS_KEY) ?? "") as {
      done: StartStep[];
      hidden: boolean;
    };
  } catch {
    return { done: [], hidden: false };
  }
}

/** Marks a Getting started step done (called where the action happens). */
export function markStep(step: StartStep): void {
  const state = readSteps();
  if (state.done.includes(step)) return;
  try {
    window.localStorage.setItem(
      STEPS_KEY,
      JSON.stringify({ ...state, done: [...state.done, step] }),
    );
    window.dispatchEvent(new Event("tl-started"));
  } catch {
    // Not stored: the card just does not tick.
  }
}

function GettingStarted() {
  const [state, setState] = useState<{ done: StartStep[]; hidden: boolean }>({
    done: [],
    hidden: true,
  });
  useEffect(() => {
    const sync = () => setState(readSteps());
    sync();
    window.addEventListener("tl-started", sync);
    return () => window.removeEventListener("tl-started", sync);
  }, []);
  if (state.hidden || state.done.length === STEPS.length) return null;
  const hide = () => {
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify({ ...state, hidden: true }));
    } catch {
      // ignore
    }
    setState({ ...state, hidden: true });
  };
  return (
    <section className="mx-3 mb-4 rounded-[6px] border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold">
          Getting started {state.done.length}/{STEPS.length}
        </h2>
        <button type="button" onClick={hide} className="text-[12px] text-white/60 hover:text-white">
          Hide
        </button>
      </div>
      <ol className="mt-2 space-y-1.5 text-[13px]">
        {STEPS.map((s, i) => {
          const done = state.done.includes(s.id);
          return (
            <li key={s.id} className="flex gap-2">
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-[#5fb3a9] text-ink" : "border border-white/40 text-white/70"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done ? "text-white/50 line-through" : "text-white/90"}>
                {s.text}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---- sidebar ------------------------------------------------------------------------------

function WorkspaceSwitcher() {
  const { user, signIn } = useUser();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!user) return null;
  return (
    <div className="relative px-3 pt-3 pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-2 text-left hover:bg-white/10"
      >
        <Avatar initials={user.initials} size={32} light />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{user.name}</span>
          <span className="block truncate text-[12px] text-white/65">{user.title}</span>
        </span>
        <span aria-hidden className="text-white/65">
          ▾
        </span>
      </button>
      {open && (
        <ul className="absolute right-3 left-3 z-30 mt-1 rounded-[8px] border border-rule bg-panel py-1 text-ink shadow-lg">
          {STAFF.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  signIn(s.id);
                  setOpen(false);
                  router.push(s.home);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-canvas ${
                  s.id === user.id ? "font-bold" : ""
                }`}
              >
                <Avatar initials={s.initials} size={24} />
                <span>
                  {s.name}
                  <span className="block text-[12px] font-normal text-ink-soft">{s.title}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-rule">
            <Link href="/" className="block px-3 py-2 text-[13px] text-ink-soft hover:bg-canvas">
              Sign out
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function NavItem({
  href,
  label,
  count,
  alert,
}: {
  href: string;
  label: string;
  count?: number | undefined;
  alert?: boolean;
}) {
  const path = usePathname();
  const active = path === href || (href !== "/" && path.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center justify-between rounded-[6px] px-3 py-2 text-[14px] ${
        active
          ? "bg-white/15 font-bold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[#5fb3a9]"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`min-w-6 rounded-full px-1.5 text-center font-figure text-[13px] tabular-nums ${
            alert ? "bg-urgent text-white" : "text-white/60"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Sidebar() {
  const { user } = useUser();
  const { data } = useLive(fetchHospital);
  const mine = user && data ? data.waiting_by_role[user.role] : undefined;
  const inProgress = data?.referrals_in_progress;
  return (
    <nav
      aria-label="Workspace"
      className="flex h-full w-[232px] shrink-0 flex-col bg-ink text-white"
    >
      <WorkspaceSwitcher />
      <GettingStarted />
      <div className="space-y-0.5 px-3">
        <NavItem
          href="/inbox"
          label="Inbox"
          count={mine}
          alert={user?.role === "nurse" && (mine ?? 0) > 0}
        />
        <NavItem href="/referrals" label="Referrals" count={inProgress} />
        <NavItem href="/today" label="Today" />
        <NavItem href="/agents" label="Agents" count={13} />
      </div>
      <p className="mt-6 px-6 text-[12px] font-bold text-white/50">Patient-facing</p>
      <div className="mt-1 space-y-0.5 px-3">
        <NavItem href="/p/maria-001" label="Patient app" />
        <NavItem href="/map" label="Wayfinding map" />
        <NavItem href="/board/imaging_ct" label="Station displays" />
      </div>
      <p className="mt-auto px-6 pb-4 text-[12px] text-white/50">Halden Medical Center</p>
    </nav>
  );
}

// ---- top bar ------------------------------------------------------------------------------

function Search() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<JourneyRow[]>([]);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return rows.filter((r) => r.patient.toLowerCase().includes(t) || r.mrn.includes(t)).slice(0, 7);
  }, [q, rows]);
  return (
    <div className="relative w-full max-w-[360px]">
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (rows.length === 0)
            void fetchReferrals()
              .then(setRows)
              .catch(() => undefined);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Search patients or MRN"
        aria-label="Search patients"
        className="h-9 w-full rounded-[6px] border border-rule bg-canvas px-3 pr-8 text-[14px] placeholder:text-ink-soft"
      />
      <kbd className="absolute top-2 right-2 rounded-[4px] border border-rule px-1 text-[11px] text-ink-soft">
        /
      </kbd>
      {open && hits.length > 0 && (
        <ul className="absolute top-10 right-0 left-0 z-30 rounded-[8px] border border-rule bg-panel py-1 shadow-lg">
          {hits.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={() => router.push(`/patients/${r.id}`)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-canvas"
              >
                <span>
                  <span className="font-bold">{r.patient}</span>{" "}
                  <span className="text-ink-soft tabular-nums">MRN {r.mrn}</span>
                </span>
                <span className="text-ink-soft">{r.stage}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { runs } = useStream();
  const { data } = useLive(fetchHospital);
  const feed =
    runs.length > 0
      ? runs.map((r) => ({
          id: r.id,
          agent: r.agent,
          at: r.at,
          summary: r.summary,
          journey_id: r.journey_id,
          outcome: r.outcome,
        }))
      : (data?.feed ?? []).map((f) => ({ ...f, id: f.run_id }));
  return (
    <Drawer open={open} onClose={onClose} title="Agent activity" width={440}>
      <ul className="divide-y divide-rule">
        {feed.map((f) => (
          <li key={f.id} className="flex gap-3 px-5 py-3 text-[13px]">
            <AgentGlyph name={f.agent} />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-bold">{agentProfile(f.agent)?.label}</span> {f.summary}
              </p>
              <p className="text-[12px] text-ink-soft">
                {shortDate(f.at)}, {hhmm(f.at)}
                {f.journey_id && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/patients/${f.journey_id}`} className="text-agent underline">
                      Open record
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

function TopBar() {
  const { data } = useLive(fetchHospital);
  const { runs } = useStream();
  const [activity, setActivity] = useState(false);
  const [newRef, setNewRef] = useState(false);
  const recent = runs.filter(
    (r) => data?.now && Date.parse(data.now) - Date.parse(r.at) < 5 * 60_000,
  );
  const working = new Set(recent.map((r) => r.agent)).size;
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-rule bg-panel/85 px-5 backdrop-blur-md">
      <Search />
      <span className="ml-auto font-figure text-[15px] text-ink-soft tabular-nums">
        {data?.now ? `${shortDate(data.now)}, ${hhmm(data.now)}` : ""}
      </span>
      <button
        type="button"
        onClick={() => setActivity(true)}
        className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] hover:bg-canvas"
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${working > 0 ? "bg-agent agent-working" : "bg-rule"}`}
        />
        {working > 0 ? `${working} agents working` : "Agent activity"}
      </button>
      <button
        type="button"
        onClick={() => setNewRef(true)}
        className="min-h-9 rounded-[6px] bg-agent px-3 text-[14px] font-bold text-white"
      >
        New referral
      </button>
      <ActivityDrawer open={activity} onClose={() => setActivity(false)} />
      <NewReferralDialog open={newRef} onClose={() => setNewRef(false)} />
    </header>
  );
}

// ---- shell --------------------------------------------------------------------------------

/** The staff workspace: sidebar, top bar, page. Signed-out visitors go to the sign-in page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useUser();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);
  if (!ready || !user) return <div className="min-h-dvh bg-canvas" />;
  return (
    <div className="flex h-dvh bg-canvas text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
