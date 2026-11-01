import { OPS_AUTOPILOT, t, type OpsProposal } from "@throughline/shared";
import { stationName } from "../lib/stations";

/**
 * An ops proposal (spec 9.4): the action in words, the predicted effect as a before/after
 * bar, the evidence behind it, and the human gate. Pending shows HELD; a decision shows who.
 */
export function Proposal({
  proposal,
  busy,
  onDecide,
}: {
  proposal: OpsProposal;
  busy: boolean;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  const { action } = proposal;
  const effect = action.predicted_effect;
  const max = Math.max(1, effect.wait_before_min, effect.wait_after_min);
  const station = stationName(effect.station_id);
  return (
    <article aria-label={action.title} className="border-l-4 border-held bg-paper py-1 pl-4">
      <h3 className="font-display text-[22px] leading-tight font-bold">{action.title}</h3>
      {action.rationale && <p className="mt-2 max-w-[60ch] text-[16px]">{action.rationale}</p>}
      <p className="mt-2 text-[15px]">
        {t("en", "ops.wait_change", {
          station,
          before: Math.round(effect.wait_before_min),
          after: Math.round(effect.wait_after_min),
        })}
      </p>
      <div aria-hidden className="mt-2 space-y-1">
        <div
          className="h-3 bg-wait-high"
          style={{ width: `${(effect.wait_before_min / max) * 100}%` }}
        />
        <div className="h-3 bg-line" style={{ width: `${(effect.wait_after_min / max) * 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">
        {t("en", "ops.affected", { count: effect.affected_journeys })}.{" "}
        {t("en", "ops.evidence", {
          replicates: action.evidence.replicates,
          horizon: action.evidence.horizon_min,
          seed: action.evidence.seed,
        })}
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">
        {t("en", "ops.proposal_footer")}
        {action.written_by && action.written_by !== "rule"
          ? ` Written by ${action.written_by}.`
          : ""}
      </p>
      {proposal.status === "pending" ? (
        <div className="mt-3">
          <p className="inline-block bg-held-bg px-2 py-0.5 text-[13px] font-bold text-held">
            {t("en", "ops.held")}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("approved")}
              className="min-h-12 rounded-[12px] bg-line px-5 text-[15px] font-bold text-paper disabled:opacity-40"
            >
              {t("en", "ops.approve")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("rejected")}
              className="min-h-12 rounded-[12px] px-3 text-[15px] font-bold text-ink-soft disabled:opacity-40"
            >
              {t("en", "ops.reject")}
            </button>
          </div>
        </div>
      ) : (
        <p role="status" className="mt-3 flex items-center gap-2 text-[15px] font-bold">
          <span aria-hidden className="text-line">
            ✓
          </span>
          {proposal.status === "resolved"
            ? proposal.resolved_by === OPS_AUTOPILOT
              ? t("en", "ops.applied_auto")
              : t("en", "ops.approved_by", { name: proposal.resolved_by ?? "" })
            : t("en", "ops.rejected_by", { name: proposal.resolved_by ?? "" })}
        </p>
      )}
    </article>
  );
}
