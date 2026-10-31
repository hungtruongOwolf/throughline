import { BoardView, Journey, OpsOverview } from "@throughline/shared";

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

export async function fetchOverview(): Promise<OpsOverview> {
  const res = await fetch(`${RUNTIME_URL}/api/ops/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`overview: ${res.status}`);
  return OpsOverview.parse(await res.json());
}

export async function resolveReview(
  reviewId: string,
  decision: "approved" | "rejected",
  by: string,
): Promise<boolean> {
  const res = await fetch(`${RUNTIME_URL}/api/reviews/${encodeURIComponent(reviewId)}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, by }),
  });
  return res.ok;
}

export async function clockCommand(
  command: { action: "start"; speed: 1 | 10 | 60 | 600 } | { action: "stop" } | { action: "jump" },
): Promise<void> {
  await fetch(`${RUNTIME_URL}/api/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
}

export interface StoredEventView {
  seq: number;
  event: {
    id: string;
    type: string;
    occurred_at: string;
    journey_id?: string;
    station_id?: string;
    payload: Record<string, unknown>;
  };
}

export async function fetchEvents(limit = 300): Promise<StoredEventView[]> {
  const res = await fetch(`${RUNTIME_URL}/api/events?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`events: ${res.status}`);
  return (await res.json()) as StoredEventView[];
}

export async function startScenario(autopilot: boolean, speed?: 10 | 60 | 600): Promise<void> {
  await fetch(`${RUNTIME_URL}/api/demo/scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ autopilot, ...(speed ? { speed } : {}) }),
  });
}

/** A text reply from the patient's phone (the simulated SMS channel). */
export async function postReply(journeyId: string, text: string): Promise<boolean> {
  const res = await fetch(`${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/reply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, channel: "sms_sim" }),
  });
  return res.ok;
}

export interface JourneyEventView {
  event: { id: string; type: string; occurred_at: string; payload: Record<string, unknown> };
}

/** A journey's audit log, oldest first; the portal dates its story from it. */
export async function fetchJourneyEvents(journeyId: string): Promise<JourneyEventView[]> {
  const res = await fetch(`${RUNTIME_URL}/api/journeys/${encodeURIComponent(journeyId)}/events`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`events ${journeyId}: ${res.status}`);
  return (await res.json()) as JourneyEventView[];
}
