import { t, type Language } from "@throughline/shared";
import { clockTime } from "../lib/format";

/** A done or upcoming stop: name on the left, the time in words on the right. */
export function Stop({
  name,
  status,
  time,
  lang,
}: {
  name: string;
  status: "done" | "future";
  time?: string;
  lang: Language;
}) {
  const when =
    time &&
    (status === "done"
      ? t(lang, "patient.done_at", { time: clockTime(time) })
      : t(lang, "patient.eta", { time: clockTime(time) }));
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 pb-6 text-[17px]">
      <span className={status === "done" ? "text-ink-soft" : ""}>{name}</span>
      {when && <span className="shrink-0 text-ink-soft tabular-nums">{when}</span>}
    </div>
  );
}
