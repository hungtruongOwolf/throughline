"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { agentProfile, STAGES, type Stage, type StaffRole, STAFF } from "@throughline/shared";

// ---- time ---------------------------------------------------------------------------------

/** "…T09:41…" → "9:41 am" (hospital local time, already in the string). */
export function hhmm(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

/** "Nov 12" for a date in the hospital's time zone (offset already in the string). */
export function shortDate(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "9:41 am" today, else "Nov 12, 9:41 am". */
export function when(iso: string, today: string): string {
  if (!iso) return "";
  return iso.slice(0, 10) === today.slice(0, 10) ? hhmm(iso) : `${shortDate(iso)}, ${hhmm(iso)}`;
}

/** Age of something on the hospital clock: "6 min", "3 h", "2 d". */
export function age(iso: string, now: string): string {
  if (!iso || !now) return "";
  const min = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60_000));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

// ---- actors -------------------------------------------------------------------------------

/** Agents are squares, people are circles: readable without color. */
export function AgentGlyph({ name, size = 22 }: { name: string; size?: number }) {
  const p = agentProfile(name);
  return (
    <span
      title={p ? `${p.label} agent` : name}
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[6px] bg-agent font-figure font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.48)) }}
    >
      {p?.glyph ?? "AI"}
    </span>
  );
}

export function Avatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-figure font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials}
    </span>
  );
}

export const ROLE_PERSON: Record<StaffRole, (typeof STAFF)[number]> = Object.fromEntries(
  STAFF.map((s) => [s.role, s]),
) as Record<StaffRole, (typeof STAFF)[number]>;

export function AgentName({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <AgentGlyph name={name} size={18} />
      <span>{agentProfile(name)?.label ?? name}</span>
    </span>
  );
}

/** Which model did the work, and how long it took. */
export function ModelChip({ model, ms }: { model?: string | undefined; ms?: number | undefined }) {
  if (!model) return null;
  const label =
    model === "meta-models/muse-spark-open"
      ? "Muse Spark Open, open weights on Baseten"
      : model === "muse-spark-1.3"
        ? "Muse Spark 1.3"
        : model === "sam-3.1"
          ? "SAM 3.1"
          : model === "muse-voice-transcribe-1.0"
            ? "Voice Transcribe"
            : model;
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-panel px-1.5 py-px text-[12px] text-ink-soft">
      {label}
      {ms !== undefined && ms >= 50 ? (
        <span className="tabular-nums">, {(ms / 1000).toFixed(1)} s</span>
      ) : null}
    </span>
  );
}

// ---- the stage rail -----------------------------------------------------------------------

/**
 * The one bold element (section 7): a teal line through the referral's stages. `counts` makes
 * it the hospital rail; `current` makes it a record or row rail.
 */
export function StageRail({
  counts,
  current,
  waiting,
  size = "record",
  onPick,
  picked,
}: {
  counts?: Partial<Record<Stage, number>>;
  current?: Stage;
  waiting?: boolean;
  size?: "hospital" | "record" | "row";
  onPick?: (stage: Stage | undefined) => void;
  picked?: Stage | undefined;
}) {
  const at = current ? STAGES.indexOf(current) : -1;
  if (size === "row") {
    return (
      <span className="inline-flex items-center" aria-label={current}>
        {STAGES.map((s, i) => (
          <span key={s} className="inline-flex items-center">
            {i > 0 && <span className={`h-[2px] w-2 ${i <= at ? "bg-agent" : "bg-rule"}`} />}
            <span
              className={`block rounded-full ${
                i === at
                  ? waiting
                    ? "h-2.5 w-2.5 bg-staff"
                    : "h-2.5 w-2.5 bg-agent ring-2 ring-agent-tint"
                  : i < at
                    ? "h-1.5 w-1.5 bg-agent"
                    : "h-1.5 w-1.5 bg-rule"
              }`}
            />
          </span>
        ))}
      </span>
    );
  }
  return (
    <ol
      className="relative grid"
      style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}
    >
      <span aria-hidden className="absolute top-[9px] right-[7%] left-[7%] h-[2px] bg-agent" />
      {STAGES.map((s, i) => {
        const done = at >= 0 && i < at;
        const now = i === at;
        const count = counts?.[s];
        const active = picked === s;
        const node = (
          <>
            <span
              className={`relative z-10 block rounded-full border-2 ${
                now
                  ? waiting
                    ? "h-5 w-5 border-staff bg-staff"
                    : "h-5 w-5 border-agent bg-agent ring-4 ring-agent-tint"
                  : done || counts
                    ? "h-5 w-5 border-agent bg-agent"
                    : "h-5 w-5 border-agent bg-panel"
              } ${active ? "ring-4 ring-ink/20" : ""}`}
            />
            <span
              className={`mt-2 text-[13px] ${now || active ? "font-bold text-ink" : "text-ink-soft"}`}
            >
              {s}
            </span>
            {count !== undefined && (
              <span className="font-figure text-[26px] leading-none font-medium tabular-nums">
                {count}
              </span>
            )}
          </>
        );
        return (
          <li key={s} className="flex flex-col items-center text-center">
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(active ? undefined : s)}
                className="flex flex-col items-center rounded-[6px] px-1 pb-1"
                aria-pressed={active}
              >
                {node}
              </button>
            ) : (
              node
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---- drawer and toast ---------------------------------------------------------------------

export function Drawer({
  open,
  onClose,
  title,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20"
      />
      <aside
        className="absolute top-0 right-0 flex h-full max-w-full flex-col bg-panel shadow-2xl"
        style={{ width }}
      >
        <header className="flex items-center justify-between border-b border-rule px-5 py-3">
          <h2 id={titleId} className="font-figure text-[20px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] px-2 py-1 text-ink-soft hover:bg-canvas"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | undefined>();
  const show = useCallback((t: string) => {
    setText(t);
    window.setTimeout(() => setText((cur) => (cur === t ? undefined : cur)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      >
        {text && (
          <p className="row-in rounded-[8px] bg-ink px-4 py-2.5 text-[14px] text-white shadow-lg">
            {text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---- small pieces -------------------------------------------------------------------------

export function Skeleton({ rows = 5, height = 40 }: { rows?: number; height?: number }) {
  return (
    <div aria-hidden className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse rounded-[4px] bg-rule/50" style={{ height }} />
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "agent",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "agent" | "staff" | "urgent";
  type?: "button" | "submit";
}) {
  const bg = tone === "urgent" ? "bg-urgent" : tone === "staff" ? "bg-staff" : "bg-agent";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-[6px] ${bg} px-4 text-[14px] font-bold text-white disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-[6px] border border-rule bg-panel px-3 text-[14px] font-bold text-ink hover:bg-canvas disabled:opacity-40"
    >
      {children}
    </button>
  );
}
