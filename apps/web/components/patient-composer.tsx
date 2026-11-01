"use client";

import { useState } from "react";
import { RUNTIME_URL } from "../lib/runtime";

const EXAMPLES = [
  "Yes, I'll be there.",
  "Can my son come with me?",
  "I need to move my appointment",
  "I've had a fever since last night",
];

/**
 * The patient writes or speaks to the clinic. Replies go to the patient messaging agent; a
 * medical question goes to a nurse. Example replies and a recorded voice note fill it in.
 */
export function PatientComposer({ journeyId, onSent }: { journeyId: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const send = async () => {
    setBusy(true);
    setStatus(undefined);
    try {
      const res = await fetch(
        `${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/reply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text.trim(), channel: "sms_sim" }),
        },
      );
      if (!res.ok) throw new Error();
      setText("");
      setStatus("Sent.");
      onSent();
    } catch {
      setStatus("That didn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const voice = async () => {
    setBusy(true);
    setStatus(undefined);
    try {
      const audio = await (await fetch(`${RUNTIME_URL}/api/voice/maria-reply.wav`)).blob();
      const form = new FormData();
      form.append("audio", audio, "note.wav");
      const res = await fetch(
        `${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/voice`,
        {
          method: "POST",
          body: form,
        },
      );
      if (!res.ok) throw new Error();
      const { transcript } = (await res.json()) as { transcript: string };
      setStatus(`Voice note sent. We heard: “${transcript}”`);
      onSent();
    } catch {
      setStatus("We couldn't hear that voice note. Try again or type it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="write-heading" className="mt-8">
      <h2 id="write-heading" className="font-display text-[24px] font-bold">
        Write to the clinic
      </h2>
      <textarea
        aria-label="Your message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-[12px] border border-ink/20 bg-white p-3 text-[16px]"
      />
      <p className="mt-1 text-[13px] text-ink-soft">Examples:</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {EXAMPLES.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setText(x)}
            className="rounded-full border border-ink/20 bg-white px-3 py-1 text-[14px]"
          >
            {x}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="min-h-11 rounded-[12px] bg-line px-5 text-[16px] font-bold text-white disabled:opacity-40"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => void voice()}
          disabled={busy}
          className="min-h-11 rounded-[12px] px-3 text-[15px] font-bold text-line underline disabled:opacity-40"
        >
          Send an example voice note
        </button>
      </div>
      {status && (
        <p role="status" className="mt-2 text-[15px]">
          {status}
        </p>
      )}
    </section>
  );
}
