import { BoardView, Journey } from "@throughline/shared";

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

export async function fetchBoard(stationId: string): Promise<BoardView> {
  const res = await fetch(`${RUNTIME_URL}/api/stations/${encodeURIComponent(stationId)}/board`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`board ${stationId}: ${res.status}`);
  return BoardView.parse(await res.json());
}

export type StaffAction =
  | { action: "start" | "done" | "didnt_arrive"; journey_id: string; order_id: string }
  | { action: "send_help"; journey_id: string }
  | { action: "resolve_task"; review_id: string; by: string };

export async function postStaffAction(stationId: string, action: StaffAction): Promise<boolean> {
  const res = await fetch(`${RUNTIME_URL}/api/stations/${encodeURIComponent(stationId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
  return res.ok;
}

/** Any domain event: boards and the command center redraw on every change. */
export function subscribeAll(onEvent: () => void): () => void {
  const source = new EventSource(`${RUNTIME_URL}/events/stream`);
  source.addEventListener("domain", () => onEvent());
  return () => source.close();
}
