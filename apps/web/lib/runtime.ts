import { Journey } from "@throughline/shared";

/** The browser talks only to the runtime (spec 8: never to a model provider). */
export const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL ?? "http://localhost:4000";

export async function fetchJourney(id: string): Promise<Journey> {
  const res = await fetch(`${RUNTIME_URL}/api/journeys/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`journey ${id}: ${res.status}`);
  return Journey.parse(await res.json());
}

export type PatientAction = { action: "im_here"; order_id: string } | { action: "talk_to_person" };

export async function postAction(journeyId: string, action: PatientAction): Promise<boolean> {
  const res = await fetch(`${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
  return res.ok;
}

/** Calls `onEvent` for every domain event about this journey; reconnects on its own (SSE). */
export function subscribeJourney(journeyId: string, onEvent: () => void): () => void {
  const source = new EventSource(`${RUNTIME_URL}/events/stream`);
  source.addEventListener("domain", (e) => {
    try {
      const event = JSON.parse((e as MessageEvent<string>).data) as { journey_id?: string };
      if (event.journey_id === journeyId) onEvent();
    } catch {
      // A malformed frame is ignored; the next event refreshes the view.
    }
  });
  return () => source.close();
}
