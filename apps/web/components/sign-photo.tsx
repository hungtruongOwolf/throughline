"use client";

import { useState } from "react";
import { RUNTIME_URL } from "../lib/runtime";

/** Signs a lost patient might be standing next to (committed photos with recorded readings). */
const EXAMPLES = [
  { file: "04.webp", label: "Café" },
  { file: "00.webp", label: "Main Lobby" },
  { file: "06.webp", label: "Elevator B, Level 2" },
];

/**
 * Lost? A photo of the nearest sign tells the hospital where the patient is (spec V5): the
 * visit companion reads the sign and sends step-free directions from there. No GPS, no faces.
 */
export function SignPhoto({ journeyId, onLocated }: { journeyId: string; onLocated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const send = async (photo: Blob, name: string) => {
    setBusy(true);
    setStatus(undefined);
    try {
      const form = new FormData();
      form.append("photo", photo, name);
      const res = await fetch(
        `${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/locate`,
        {
          method: "POST",
          body: form,
        },
      );
      if (!res.ok) throw new Error(String(res.status));
      setStatus("Found you. We sent you the way from there. It is in your latest texts.");
      onLocated();
    } catch {
      setStatus("We couldn't read that sign. Try another one, or use Talk to a person.");
    } finally {
      setBusy(false);
    }
  };
  const example = async (file: string) => {
    const photo = await (await fetch(`${RUNTIME_URL}/api/signs/${file}`)).blob();
    await send(photo, file);
  };
  return (
    <section aria-labelledby="lost-heading" className="mt-8 border-[3px] border-ink/10 p-5">
      <h2 id="lost-heading" className="font-display text-[24px] font-bold">
        Lost? Send a photo of the nearest sign
      </h2>
      <p className="mt-1 text-[16px] text-ink-soft">
        We read the sign and send you the way from there.
      </p>
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-[12px] px-4 text-[16px] font-bold text-line ring-2 ring-line">
        Take or choose a photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f, f.name);
          }}
        />
      </label>
      <p className="mt-4 text-[13px] text-ink-soft">Or use an example photo:</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {EXAMPLES.map((x) => (
          <button
            key={x.file}
            type="button"
            disabled={busy}
            onClick={() => void example(x.file)}
            className="w-[120px] text-left disabled:opacity-40"
          >
            <img
              src={`${RUNTIME_URL}/api/signs/${x.file}`}
              alt={`Photo of the ${x.label} sign`}
              className="h-[80px] w-[120px] rounded-[8px] object-cover ring-1 ring-ink/15"
            />
            <span className="mt-1 block text-[13px]">{x.label}</span>
          </button>
        ))}
      </div>
      {status && (
        <p role="status" className="mt-3 text-[15px]">
          {status}
        </p>
      )}
    </section>
  );
}
