"use client";

import { useState } from "react";
import type { IncidentKind, StationId } from "@throughline/shared";
import { PrimaryButton } from "../../components/ui";
import { campus, node } from "../../lib/campus";
import { reportIncident, type ReportOutcome } from "../../lib/runtime";
import { stationName } from "../../lib/stations";

const KINDS: { kind: IncidentKind; label: string }[] = [
  { kind: "room_down", label: "A room or machine is out of service" },
  { kind: "short_staffed", label: "We are short one staff member" },
  { kind: "surge", label: "More patients than usual are arriving" },
];

const DURATIONS = [30, 60, 90, 120];

/** What happened after a report, in the words the manager needs next. */
function outcomeText(o: ReportOutcome, station: StationId): string {
  const name = stationName(station);
  switch (o.result) {
    case "applied":
      return `The planner applied a small change within policy: ${o.title}. It is listed above.`;
    case "proposed":
      return `The planner proposed a change: ${o.title}. It waits for your approval above.`;
    case "escalated":
      return `Nothing the planner can do shortens the wait at ${name}. It asked a manager in the inbox.`;
    case "no_change":
      return `The forecast for ${name} stays under 20 minutes. Nothing needs to change; sensing keeps watching the line.`;
    case "error":
      return o.error;
  }
}

/**
 * Staff tell the floor what the cameras cannot see yet. The planner forecasts the next 90
 * minutes with the incident and acts on any station the same way.
 */
export function ReportProblem({
  station,
  by,
  open,
  onReported,
}: {
  station: StationId;
  by: string;
  /** False outside the simulated day's opening hours. */
  open: boolean;
  onReported: () => void;
}) {
  const rooms = campus.stations.find((s) => s.id === station)?.nodes ?? [];
  const [kind, setKind] = useState<IncidentKind>("room_down");
  const [room, setRoom] = useState<string>("");
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ station: StationId; text: string } | undefined>();
  const chosenRoom = rooms.includes(room) ? room : rooms[0];

  const submit = () => {
    setBusy(true);
    setStatus(undefined);
    void reportIncident(station, {
      kind,
      ...(kind === "room_down" && rooms.length > 1 && chosenRoom ? { node_id: chosenRoom } : {}),
      minutes,
      by,
    })
      .then((o) => {
        setStatus({ station, text: outcomeText(o, station) });
        if (o.result !== "error") onReported();
      })
      .catch(() => setStatus({ station, text: "The report did not go through. Try again." }))
      .finally(() => setBusy(false));
  };

  return (
    <section aria-labelledby="report-heading" className="mt-8 border-t border-rule pt-5 pb-6">
      <h2 id="report-heading" className="font-display text-[22px] font-bold">
        Report a problem at {stationName(station)}
      </h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Select another station on the map to report there.
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">What is happening</legend>
        {KINDS.map((k) => (
          <label key={k.kind} className="flex items-center gap-2 py-1 text-[14px]">
            <input
              type="radio"
              name="incident-kind"
              value={k.kind}
              checked={kind === k.kind}
              onChange={() => setKind(k.kind)}
              className="accent-line"
            />
            {k.label}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-4">
        {kind === "room_down" && rooms.length > 1 && (
          <label className="text-[13px] font-bold">
            Room
            <select
              value={chosenRoom}
              onChange={(e) => setRoom(e.target.value)}
              className="mt-1 block rounded-[6px] border border-rule bg-paper px-2 py-1 text-[14px] font-normal"
            >
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {node(r)?.label ?? r}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-[13px] font-bold">
          For about
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 block rounded-[6px] border border-rule bg-paper px-2 py-1 text-[14px] font-normal"
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <PrimaryButton tone="staff" onClick={submit} disabled={busy || !open}>
          {busy ? "Reporting…" : "Report"}
        </PrimaryButton>
      </div>
      {!open && (
        <p className="mt-2 text-[13px] text-ink-soft">
          The floor is open 7:00 to 17:00. Move the clock into the visit day to report.
        </p>
      )}
      <p role="status" className="mt-3 text-[14px]">
        {status?.station === station ? status.text : ""}
      </p>
    </section>
  );
}
