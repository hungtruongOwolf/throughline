"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { documentUrl, fetchFaxLine, receiveFax, type FaxLineItem } from "../lib/platform";
import { markStep } from "./shell";
import { Drawer, hhmm, PrimaryButton } from "./ui";

/**
 * Referrals arrive on the fax line (section 4.3). Receiving one opens a new record and the
 * agents start reading it while you watch.
 */
export function NewReferralDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [faxes, setFaxes] = useState<FaxLineItem[] | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    setFaxes(undefined);
    setError(false);
    fetchFaxLine()
      .then((list) => {
        setFaxes(list);
        setPicked(list[0]?.id);
      })
      .catch(() => setError(true));
  }, [open]);
  const receive = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const journey = await receiveFax(picked);
      markStep("fax");
      onClose();
      router.push(`/patients/${journey.id}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const chosen = faxes?.find((f) => f.id === picked);
  return (
    <Drawer open={open} onClose={onClose} title="New referral" width={760}>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px]">
        <div className="min-h-[360px] rounded-[6px] border border-rule bg-canvas">
          {chosen ? (
            <img
              src={documentUrl(chosen.fax)}
              alt={`Faxed referral for ${chosen.patient} from ${chosen.practice}`}
              className="w-full rounded-[6px]"
            />
          ) : (
            <p className="p-6 text-[14px] text-ink-soft">
              {faxes && faxes.length === 0 ? "No faxes waiting." : "Loading the fax line."}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-[14px] font-bold">
            Fax line{faxes ? `, ${faxes.length} waiting` : ""}
          </h3>
          <ul className="mt-2 space-y-2">
            {(faxes ?? []).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setPicked(f.id)}
                  aria-pressed={picked === f.id}
                  className={`w-full rounded-[6px] border px-3 py-2.5 text-left text-[13px] ${
                    picked === f.id
                      ? "border-agent bg-agent-tint"
                      : "border-rule bg-panel hover:bg-canvas"
                  }`}
                >
                  <span className="block font-bold">{f.practice}</span>
                  <span className="block text-ink-soft">
                    {f.patient}, {f.pages} page, arrived {hhmm(f.arrived_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-ink-soft">
            Receiving opens the patient&apos;s record. Intake reads the fax, coverage is checked,
            and anything that needs a person comes to your inbox.
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={receive} disabled={!picked || busy}>
              {busy ? "Receiving…" : "Receive referral"}
            </PrimaryButton>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-urgent">
              The fax line didn&apos;t respond. Try again.
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
