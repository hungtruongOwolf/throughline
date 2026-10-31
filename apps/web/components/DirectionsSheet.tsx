"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { t, type Language, type RouteStep, type WalkingRoute } from "@throughline/shared";
import { RUNTIME_URL } from "../lib/runtime";
import { MapSnippet } from "./MapSnippet";

export function stepText(step: RouteStep, lang: Language): string {
  if (step.kind === "elevator") {
    return t(lang, "directions.elevator", { place: step.to_label, floor: step.floor ?? "" });
  }
  if (step.kind === "stairs") return t(lang, "directions.stairs", { floor: step.floor ?? "" });
  return t(lang, "directions.walk", {
    place: step.to_label,
    minutes: Math.max(1, Math.round(step.seconds / 60)),
  });
}

/**
 * Consecutive walking legs become one step to the last place before an elevator, the stairs,
 * or the destination: three clear steps read better than seven short ones.
 */
export function simplifySteps(steps: RouteStep[]): RouteStep[] {
  const out: RouteStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === "walk" && step.kind === "walk") {
      out[out.length - 1] = { ...step, seconds: prev.seconds + step.seconds };
    } else {
      out.push(step);
    }
  }
  return out;
}

/**
 * Directions as a sheet (spec 9.3): the corridor snippet, then numbered steps, which are the
 * accessible version of the map. The sign-photo button lives here, not on the main screen.
 */
export function DirectionsSheet({
  open,
  onClose,
  journeyId,
  from,
  place,
  route,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  journeyId: string;
  from: string;
  place: string;
  route: WalkingRoute | undefined;
  lang: Language;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [photo, setPhoto] = useState<"idle" | "reading" | "failed">("idle");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto("reading");
    const body = new FormData();
    body.append("photo", file);
    const res = await fetch(`${RUNTIME_URL}/api/journeys/${journeyId}/locate`, {
      method: "POST",
      body,
    }).catch(() => undefined);
    setPhoto(res?.ok ? "idle" : "failed");
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="directions-title"
      className="m-0 mt-auto max-h-[92vh] w-full max-w-none bg-paper px-6 pt-6 pb-8 text-ink backdrop:bg-ink/40"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="directions-title" className="font-display text-[28px] leading-tight font-bold">
          {t(lang, "directions.title", { place })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 shrink-0 rounded-[12px] px-2 text-[17px] font-bold text-line"
        >
          {t(lang, "directions.close")}
        </button>
      </div>
      {route && (
        <>
          <div className="mt-4">
            <MapSnippet
              from={from}
              steps={route.steps}
              youAreHere={t(lang, "directions.you_are_here")}
            />
          </div>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-[17px]">
            {simplifySteps(route.steps).map((s, i) => (
              <li key={`${s.to_node_id}-${i}`}>{stepText(s, lang)}</li>
            ))}
          </ol>
          <p className="mt-4 text-ink-soft">
            {t(lang, "directions.total", { minutes: Math.max(1, Math.round(route.seconds / 60)) })}
          </p>
        </>
      )}
      <label className="mt-6 flex min-h-12 cursor-pointer items-center text-[17px] font-bold text-line">
        {photo === "reading" ? t(lang, "directions.reading_sign") : t(lang, "directions.photo")}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => void onPhoto(e)}
        />
      </label>
      {photo === "failed" && (
        <p role="status" className="mt-2">
          {t(lang, "patient.sign_unreadable")}
        </p>
      )}
    </dialog>
  );
}
