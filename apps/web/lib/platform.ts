import type {
  AgentStats,
  HospitalOverview,
  InboxItem,
  JourneyRow,
  RunView,
  StaffRole,
  TimelineEntry,
} from "@throughline/shared";
import { RUNTIME_URL } from "./runtime";

/** The staff platform's reads and writes against the runtime (docs/PLATFORM-DESIGN.md). */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${RUNTIME_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${RUNTIME_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export const fetchHospital = () => get<HospitalOverview>("/api/overview");
export const fetchInbox = (role?: StaffRole, status: "pending" | "done" = "pending") =>
  get<InboxItem[]>(`/api/inbox?status=${status}${role ? `&role=${role}` : ""}`);
export const fetchReferrals = () => get<JourneyRow[]>("/api/referrals");
export const fetchAgents = () => get<AgentStats[]>("/api/agents");
export const fetchAgentRuns = (name: string) =>
  get<RunView[]>(`/api/agents/${encodeURIComponent(name)}/runs`);
export const fetchTimeline = (id: string) =>
  get<TimelineEntry[]>(`/api/journeys/${encodeURIComponent(id)}/timeline`);
export const fetchRun = (id: string) => get<RunView>(`/api/runs/${encodeURIComponent(id)}`);

export interface FaxLineItem {
  id: string;
  patient: string;
  practice: string;
  provider: string;
  arrived_at: string;
  pages: number;
  fax: string;
}
export const fetchFaxLine = () => get<FaxLineItem[]>("/api/fax-line");
export const receiveFax = (fax: string) => post<{ id: string }>("/api/referrals", { fax });

export const resolveItem = (
  id: string,
  body: { decision: "approved" | "rejected"; by: string; note?: string },
) => post<unknown>(`/api/reviews/${encodeURIComponent(id)}/resolve`, body);

export const answerQuestion = (journeyId: string, field: string, value: string, by: string) =>
  post<unknown>(`/api/journeys/${encodeURIComponent(journeyId)}/clarify`, { field, value, by });

export const sendReply = (journeyId: string, text: string) =>
  post<unknown>(`/api/journeys/${encodeURIComponent(journeyId)}/reply`, {
    text,
    channel: "sms_sim",
  });

export function documentUrl(uri: string): string {
  return uri.startsWith("http") ? uri : `${RUNTIME_URL}${uri}`;
}
