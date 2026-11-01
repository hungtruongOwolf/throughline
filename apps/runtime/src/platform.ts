import {
  AGENT_CATALOG,
  agentProfile,
  roleForReview,
  STAGES,
  stageOf,
  type AgentRun,
  type DomainEvent,
  type HumanReview,
  type Journey,
  type StaffRole,
  type InboxItem,
  type InboxKind,
  type JourneyRow,
  type AgentStats,
  type RunView,
  type FeedEntry,
  type TimelineEntry,
} from "@throughline/shared";
import { campus } from "@throughline/hospital";
import { describeRun } from "./describe";
import type { RuntimeStore } from "./bus/store";

/**
 * Read models for the staff platform (docs/PLATFORM-DESIGN.md): the hospital overview, the
 * inbox of items a person must act on, the agent roster with metrics, the referral rows, and
 * a patient's timeline. Everything is computed from the event log, runs, and reviews.
 */

function journeys(store: RuntimeStore): Journey[] {
  return store.listAggregates<Journey>("journey");
}

function nameOf(store: RuntimeStore, journeyId?: string): string | undefined {
  if (!journeyId) return undefined;
  return store.loadAggregate<Journey>("journey", journeyId)?.value.patient.display_name;
}

/** When each review was opened: the HumanReviewRequested event, else the parked event. */
function openedAt(store: RuntimeStore): Map<string, string> {
  const at = new Map<string, string>();
  for (const { event } of store.events()) {
    if (event.type === "HumanReviewRequested") at.set(event.payload.review_id, event.occurred_at);
  }
  return at;
}

// ---- inbox --------------------------------------------------------------------------------

function titleFor(r: HumanReview): string {
  if (r.kind === "handoff") return "Nurse handoff";
  if (r.capability === "prior_auth.submit") return "Approve insurance submission";
  if (r.capability === "ops_action.apply") return "Approve a change on the floor";
  if (r.capability === "summary.send") return "Sign the visit summary";
  return "Task";
}

const KIND_ORDER: Record<InboxKind, number> = { handoff: 0, approval: 1, question: 2, task: 3 };

export function inbox(
  store: RuntimeStore,
  opts: { role?: StaffRole; status?: "pending" | "done" } = {},
): InboxItem[] {
  const opened = openedAt(store);
  const items: InboxItem[] = store.reviews().map((r) => ({
    id: r.id,
    kind: r.kind === "approval" ? "approval" : r.kind,
    title: titleFor(r),
    role: roleForReview(r),
    agent: r.agent,
    capability: r.capability,
    reason: r.reason,
    ...(r.journey_id ? { journey_id: r.journey_id } : {}),
    ...(nameOf(store, r.journey_id) ? { patient: nameOf(store, r.journey_id) } : {}),
    ...(r.station_id ? { station_id: r.station_id } : {}),
    opened_at:
      opened.get(r.id) ??
      (r.pending_event as DomainEvent | undefined)?.occurred_at ??
      r.resolved_at ??
      "",
    status: r.status,
    ...(r.resolved_by ? { resolved_by: r.resolved_by } : {}),
    ...(r.resolved_at ? { resolved_at: r.resolved_at } : {}),
    ...(r.note ? { note: r.note } : {}),
    review: r,
  }));
  // Intake questions are journeys waiting on an answer, not reviews.
  for (const j of journeys(store)) {
    if (j.state !== "CLARIFICATION_NEEDED") continue;
    const asked = [...store.events({ journeyId: j.id })]
      .reverse()
      .find((e) => e.event.type === "ClarificationNeeded")?.event as
      Extract<DomainEvent, { type: "ClarificationNeeded" }> | undefined;
    items.push({
      id: `question:${j.id}`,
      kind: "question",
      title: "Answer an intake question",
      role: "coordinator",
      agent: "referral_intake",
      capability: "referral.clarify",
      reason: asked?.payload.question ?? "The referral needs a detail the fax does not give.",
      journey_id: j.id,
      patient: j.patient.display_name,
      opened_at: asked?.occurred_at ?? j.updated_at,
      status: "pending",
      question: {
        field: asked?.payload.field ?? "referral",
        text: asked?.payload.question ?? "",
      },
    });
  }
  const wanted = items.filter(
    (i) =>
      (!opts.role || i.role === opts.role) &&
      (opts.status === "done" ? i.status !== "pending" : i.status === "pending"),
  );
  return wanted.sort((a, b) =>
    opts.status === "done"
      ? (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "")
      : KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.opened_at.localeCompare(b.opened_at),
  );
}

// ---- referral rows ------------------------------------------------------------------------

function firstVisit(j: Journey): string | undefined {
  return j.appointments
    .filter((a) => a.status === "booked" && !a.order_id.startsWith("o-fu-"))
    .map((a) => a.start)
    .sort()[0];
}

function waitingOn(j: Journey, pending: InboxItem[]): JourneyRow["waiting_on"] {
  const mine = pending.find((i) => i.journey_id === j.id);
  if (mine) return { kind: "staff", who: mine.role };
  switch (j.state) {
    case "AUTH_SUBMITTED":
      return { kind: "payer", who: "Payer" };
    case "PREP_SENT":
    case "TEACHBACK_PENDING":
      return { kind: "patient", who: "Patient" };
    case "REFERRAL_CLOSED":
      return { kind: "none", who: "" };
    case "SCHEDULED":
    case "CONFIRMED":
      return { kind: "agent", who: "messenger" };
    case "ARRIVED":
    case "PLANNED":
    case "ACTIVE":
      return { kind: "agent", who: "companion" };
    default:
      return { kind: "agent", who: j.phase === "POST" ? "followup" : "referral_intake" };
  }
}

function nextStep(j: Journey, pending: InboxItem[]): string {
  const mine = pending.find((i) => i.journey_id === j.id);
  if (mine) return mine.kind === "task" ? mine.reason : mine.title;
  const visit = firstVisit(j);
  const day = visit
    ? new Date(`${visit.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : undefined;
  switch (j.state) {
    case "REFERRAL_RECEIVED":
      return "Reading the fax";
    case "INTAKE_EXTRACTED":
    case "ELIGIBILITY_CHECKED":
      return "Checking coverage";
    case "AUTH_SUBMITTED":
      return "Payer decision expected within 2 business days";
    case "AUTH_DECIDED":
      return "Booking the visit";
    case "SCHEDULED":
      return day ? `Sending the plan for ${day}` : "Sending the plan";
    case "PREP_SENT":
      return day ? `Patient to confirm ${day}` : "Patient to confirm";
    case "CONFIRMED":
      return day ? `Visit ${day}` : "Visit booked";
    case "ARRIVED":
    case "PLANNED":
    case "ACTIVE": {
      const stop = j.itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
      return stop
        ? `In the building, next: ${campus.stations.find((x) => x.id === stop.station_id)?.name ?? stop.station_id}`
        : "In the building";
    }
    case "CHECKED_OUT":
    case "FOLLOWUPS_BOOKED":
    case "SUMMARY_DRAFTED":
      return "Preparing the visit summary";
    case "SUMMARY_SENT":
      return "Teach-back questions go out tomorrow";
    case "TEACHBACK_PENDING":
      return "Patient to answer three questions";
    case "TEACHBACK_DONE":
    case "RESULTS_ACKNOWLEDGED":
      return "Day-3 check-in";
    case "REFERRAL_CLOSED":
      return "Closed, report sent to the referring doctor";
    default:
      return "";
  }
}

export function journeyRows(store: RuntimeStore): JourneyRow[] {
  const pending = inbox(store);
  return journeys(store)
    .map((j) => ({
      id: j.id,
      patient: j.patient.display_name,
      mrn: j.patient.id.replace(/\D/g, "").padStart(6, "0"),
      language: j.patient.language,
      mobility: j.patient.mobility,
      referring_provider: j.referral.referring_provider,
      service: j.referral.service_requested,
      stage: stageOf(j),
      state: j.state,
      received_at: j.created_at,
      updated_at: j.updated_at,
      waiting_on: waitingOn(j, pending),
      next_step: nextStep(j, pending),
      flags: [
        ...(j.patient.mobility === "wheelchair" ? ["Wheelchair"] : []),
        ...(j.patient.language === "es" ? ["Spanish"] : []),
        ...(j.handoff_open ? ["Nurse handoff open"] : []),
      ],
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

// ---- agents -------------------------------------------------------------------------------

export function agentStats(store: RuntimeStore): AgentStats[] {
  const runs = store.runs();
  const reviews = store.reviews();
  return AGENT_CATALOG.map((a) => {
    const mine = runs.filter((r) => r.agent === a.name);
    const durations = mine.map((r) => r.duration_ms).sort((x, y) => x - y);
    const decided = reviews.filter((r) => r.agent === a.name && r.status !== "pending");
    const gated = reviews.some((r) => r.agent === a.name && r.kind === "approval");
    return {
      name: a.name,
      label: a.label,
      glyph: a.glyph,
      job: a.job,
      runs_on: a.runsOn,
      uses_model: a.usesModel,
      guardrails: a.guardrails,
      group: a.group,
      runs: mine.length,
      finished_alone: mine.filter((r) => r.outcome === "applied" && !r.used_template).length,
      waited_for_staff: mine.filter((r) => r.outcome === "parked").length,
      handed_to_nurse: mine.filter((r) => r.outcome === "handoff").length,
      used_template: mine.filter((r) => r.used_template).length,
      staff_changed: gated ? decided.filter((r) => r.status === "rejected").length : null,
      staff_decided: decided.length,
      median_ms: durations.length ? (durations[Math.floor(durations.length / 2)] ?? null) : null,
      waiting_now: reviews.filter((r) => r.agent === a.name && r.status === "pending").length,
      ...(mine.at(-1) ? { last_run_at: mine.at(-1)?.at } : {}),
    };
  });
}

export function runView(store: RuntimeStore, run: AgentRun): RunView {
  const all = new Map(store.events().map((e) => [e.event.id, e.event]));
  const trigger = all.get(run.trigger.event_id);
  return {
    ...run,
    label: agentProfile(run.agent)?.label ?? run.agent,
    ...(nameOf(store, run.journey_id) ? { patient: nameOf(store, run.journey_id) } : {}),
    model_calls: run.model_call_ids.flatMap((id) => store.modelCall(id) ?? []),
    ...(trigger ? { trigger_event: trigger } : {}),
    emitted_events: run.emitted.flatMap((e) => all.get(e.id) ?? []),
  };
}

export function agentRuns(store: RuntimeStore, agent: string, limit = 40): RunView[] {
  return store
    .runs({ agent })
    .slice(-limit)
    .reverse()
    .map((r) => runView(store, r));
}

// ---- overview -----------------------------------------------------------------------------

export function feedEntry(store: RuntimeStore, r: AgentRun): FeedEntry {
  const p = agentProfile(r.agent);
  return {
    run_id: r.id,
    agent: r.agent,
    label: p?.label ?? r.agent,
    glyph: p?.glyph ?? "··",
    at: r.at,
    ...(nameOf(store, r.journey_id) ? { patient: nameOf(store, r.journey_id) } : {}),
    ...(r.journey_id ? { journey_id: r.journey_id } : {}),
    summary: describeRun(r) ?? r.summary,
    outcome: r.outcome,
  };
}

export function overview(store: RuntimeStore, inBuilding: number) {
  const all = journeys(store);
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<string, number>;
  for (const j of all) counts[stageOf(j)] = (counts[stageOf(j)] ?? 0) + 1;
  const pending = inbox(store);
  const runs = store.runs();
  // Sensing runs every tick on every camera; the feed shows work done for patients and stations.
  const feed = runs
    .filter((r) => describeRun(r) !== undefined)
    .slice(-8)
    .reverse()
    .map((r) => feedEntry(store, r));
  const byRole = Object.fromEntries(
    (["coordinator", "nurse", "clinician", "ops"] as const).map((role) => [
      role,
      pending.filter((i) => i.role === role).length,
    ]),
  );
  return {
    stages: STAGES.map((s) => ({ stage: s, count: counts[s] ?? 0 })),
    referrals_in_progress: all.filter((j) => j.state !== "REFERRAL_CLOSED").length,
    in_building: inBuilding,
    waiting_on_staff: pending.length,
    waiting_by_role: byRole,
    runs_today: runs.length,
    feed,
  };
}

// ---- timeline -----------------------------------------------------------------------------

export function timeline(store: RuntimeStore, journeyId: string): TimelineEntry[] {
  const entries: { seq: number; entry: TimelineEntry }[] = [];
  const runs = store.runs({ journeyId });
  const events = store.events({ journeyId });
  const seqOf = new Map(events.map((e) => [e.event.id, e.seq]));
  for (const r of runs) {
    if (describeRun(r) === undefined) continue;
    const call = r.model_call_ids[0] ? store.modelCall(r.model_call_ids[0]) : undefined;
    entries.push({
      seq: seqOf.get(r.trigger.event_id) ?? 0,
      entry: {
        kind: "agent",
        at: r.at,
        run: {
          ...feedEntry(store, r),
          used_template: r.used_template,
          ...(call && call.model !== "fallback"
            ? { model: call.model, latency_ms: Math.round(call.latency_ms) }
            : {}),
        },
      },
    });
  }
  for (const { seq, event } of events) {
    if (event.type === "ReferralReceived") {
      entries.push({
        seq: seq - 0.5,
        entry: {
          kind: "outside",
          at: event.occurred_at,
          who: "Fax line",
          text: "Referral received by fax",
        },
      });
    } else if (event.type === "ClarificationAnswered") {
      entries.push({
        seq: seq - 0.5,
        entry: {
          kind: "staff",
          at: event.occurred_at,
          who: event.payload.by,
          text: `Answered the intake question (${event.payload.field.replace("_", " ")})`,
        },
      });
    } else if (event.type === "PatientReplied") {
      entries.push({
        seq: seq - 0.5,
        entry: {
          kind: "patient",
          at: event.occurred_at,
          text: event.payload.text ?? event.payload.transcript ?? "",
          channel: event.payload.channel,
        },
      });
    } else if (event.type === "PriorAuthDecided") {
      entries.push({
        seq: seq - 0.5,
        entry: {
          kind: "outside",
          at: event.occurred_at,
          who: "Payer",
          text: `Prior authorization ${event.payload.decision}`,
        },
      });
    }
  }
  for (const r of store.reviews().filter((x) => x.journey_id === journeyId)) {
    if (r.status === "pending") {
      entries.push({
        seq: Number.MAX_SAFE_INTEGER,
        entry: {
          kind: "waiting",
          at: "",
          role: roleForReview(r),
          text: titleFor(r),
          item_id: r.id,
        },
      });
    } else if (r.resolved_at) {
      const verb =
        r.kind === "handoff" || r.kind === "task"
          ? "Closed"
          : r.status === "resolved"
            ? "Approved"
            : "Sent back";
      entries.push({
        seq: nearestSeq(events, r.resolved_at),
        entry: {
          kind: "staff",
          at: r.resolved_at,
          who: r.resolved_by ?? "Staff",
          text: `${verb}: ${titleFor(r).toLowerCase()}`,
          ...(r.note ? { note: r.note } : {}),
        },
      });
    }
  }
  // In time order; same-minute entries keep the order they happened in.
  const key = (e: { seq: number; entry: TimelineEntry }) => e.entry.at || "9999";
  return entries.sort((a, b) => key(a).localeCompare(key(b)) || a.seq - b.seq).map((e) => e.entry);
}

/** Places a staff decision after the last event at or before its time. */
function nearestSeq(events: { seq: number; event: DomainEvent }[], at: string): number {
  let seq = 0;
  for (const e of events) if (e.event.occurred_at <= at) seq = e.seq;
  return seq + 0.25;
}
