import type { AgentRun } from "@throughline/shared";

function dayOf(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const emitted = (run: AgentRun, type: string) => run.emitted.some((e) => e.type === type);

/**
 * What an agent run did, as one plain sentence for the feed and the patient timeline
 * (docs/PLATFORM-DESIGN.md section 5). Returns undefined for runs that changed nothing worth
 * showing (a plan confirmed unchanged, a loop still open, a routine count); those still count
 * in the agent's metrics and keep their raw summary in the run detail.
 */
export function describeRun(run: AgentRun): string | undefined {
  const s = run.summary;
  if (run.outcome === "handoff") return "handed a clinical question to the nurse";
  if (run.outcome === "blocked")
    return "held back a message that read as clinical and sent an approved one";
  switch (run.capability) {
    case "referral.extract":
    case "referral.clarify":
      return emitted(run, "ClarificationNeeded")
        ? "could not read the member ID on the fax and asked the coordinator"
        : "read the faxed referral";
    case "eligibility.check": {
      const n = /(\d+) order/.exec(s)?.[1];
      return n && n !== "0"
        ? `verified Lonestar coverage; ${n} services need prior authorization`
        : "verified Lonestar coverage";
    }
    case "prior_auth.draft":
      return "drafted the prior authorization request";
    case "prior_auth.submit":
      return run.outcome === "parked"
        ? "is waiting for approval to submit to Lonestar Health Plan"
        : `submitted the request to Lonestar Health Plan${run.approved_by ? `, approved by ${run.approved_by}` : ""}`;
    case "schedule.plan": {
      if (s.startsWith("no schedule"))
        return "found no slot that fits and asked for booking by hand";
      const days = [...s.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => dayOf(m[1] ?? ""));
      return days.length ? `found a plan for ${days.join(" and ")}` : "planned the visit";
    }
    case "schedule.book": {
      const n = /booked (\d+)/.exec(s)?.[1];
      return n ? `booked ${n} appointments` : "booked the visit";
    }
    case "noshow.score": {
      const p = /risk ([\d.]+)/.exec(s)?.[1];
      return p ? `scored the no-show risk at ${Math.round(Number(p) * 100)}%` : undefined;
    }
    case "prep.compose":
      return "sent the plan for the visit: times, where to go, what to bring";
    case "message.send":
      if (s.startsWith("reminder"))
        return `sent a reminder ${/(\d+)h/.exec(s)?.[1] === "72" ? "3 days" : "1 day"} before the visit`;
      if (s.startsWith("teach-back")) return "sent three questions to check the summary was clear";
      if (s.startsWith("logistics")) return "sent the day-3 check-in";
      return "sent a message";
    case "reply.handle": {
      const intent = /reply: (\w+)/.exec(s)?.[1];
      const memory = /memory (.+)$/.exec(s)?.[1];
      const read =
        intent === "confirm"
          ? "read the patient's reply: confirmed"
          : intent === "reschedule"
            ? "read the patient's reply: wants another day"
            : intent === "question"
              ? "read the patient's reply: a question about the visit"
              : "read the patient's reply";
      return memory ? `${read}, and noted ${memory.replaceAll("_", " ")}` : read;
    }
    case "handoff.request":
      return "handed a clinical question to the nurse";
    case "itinerary.plan":
      return `planned the day's ${/planned (\d+)/.exec(s)?.[1] ?? ""} stops`.replace("  ", " ");
    case "itinerary.replan":
      return /unchanged/.test(s) ? undefined : s.replace(/^replanned: /, "re-planned the day: ");
    case "patient.message":
      return "texted the patient where to go next and how long the wait is";
    case "directions.send":
      return "sent step-free directions";
    case "patient.locate":
      return "located the patient from a photo of a sign";
    case "queue.estimate":
      return undefined;
    case "bottleneck.detect":
      return run.emitted.length ? "spotted a growing queue" : undefined;
    case "ops_action.propose": {
      const title = /^proposed: (.+?)(?: \(.+\))?$/.exec(s)?.[1];
      return title ? `proposed: ${title}` : "proposed a change on the floor";
    }
    case "ops_action.apply":
      return run.outcome === "parked"
        ? "is waiting for the operations lead to approve a change"
        : `applied the change${run.approved_by ? `, approved by ${run.approved_by}` : ""}`;
    case "result.watch":
      return "told the patient the lab has the sample";
    case "result_ack.track":
      return /already/.test(s) ? undefined : "flagged a result not acknowledged in 48 hours";
    case "summary.draft":
      return "drafted the visit summary in plain words beside the doctor's notes";
    case "summary.send":
      return run.outcome === "parked"
        ? "is waiting for the clinician's signature"
        : `sent the visit summary${run.approved_by ? `, signed by ${run.approved_by}` : ""}`;
    case "teachback.run":
      return /passed/.test(s)
        ? "checked the patient's answers: all clear"
        : "checked the patient's answers: one was unclear, a nurse will call";
    case "followup.book":
      return s.startsWith("no follow-up")
        ? "found no follow-up slot and asked for booking by hand"
        : "booked follow-up labs and visit";
    case "logistics.checkin":
      return "read the day-3 check-in";
    case "referral.close":
      return s.startsWith("open:")
        ? undefined
        : "closed the referral and sent the report to the referring doctor";
    default:
      return s;
  }
}
