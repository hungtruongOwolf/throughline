"use client";

import { useCallback, useEffect, useState } from "react";
import { t, type BoardRow, type BoardTask, type BoardView } from "@throughline/shared";
import { QueueSpark } from "../../../components/QueueSpark";
import { clockTime } from "../../../lib/format";
import { fetchBoard, postStaffAction, subscribeAll, type StaffAction } from "../../../lib/runtime";
import { ZONE_BG } from "../../../lib/zone-classes";

const LANG = "en" as const;
const STAFF = "staff.board";

function statusWords(row: BoardRow): string {
  if (row.status === "in_service") return t(LANG, "board.in_room", { room: row.room ?? "" });
  if (row.status === "waiting") return t(LANG, "board.waiting");
  return row.from ? t(LANG, "board.walking_from", { place: row.from }) : t(LANG, "board.walking");
}

/**
 * Rows stay at board size, so with tasks showing fewer rows fit on one screen. Live rows are
 * never dropped; simulated rows fill the remaining space in time order.
 */
function visibleRows(board: BoardView): BoardRow[] {
  const limit = board.tasks.length > 0 ? 6 : 8;
  const live = board.arriving.filter((r) => !r.simulated).length;
  let simLeft = Math.max(0, limit - live);
  return board.arriving.filter((r) => !r.simulated || simLeft-- > 0);
}

const BUTTON =
  "min-h-14 rounded-[12px] px-5 font-display text-[24px] font-semibold disabled:opacity-40";

/**
 * Station board (spec 9.3): a dark departures board readable from two meters. Initials and
 * ticket numbers only, never a full name. Tasks sit in a held-colored row, never a modal.
 */
export function StationBoard({ stationId }: { stationId: string }) {
  const [board, setBoard] = useState<BoardView | undefined>();
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    fetchBoard(stationId)
      .then((b) => {
        setBoard(b);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, [stationId]);

  useEffect(() => {
    refresh();
    const stop = subscribeAll(refresh);
    // The sim clock moves without events too; redraw every 10 s.
    const timer = setInterval(refresh, 10_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [refresh]);

  const act = (action: StaffAction) => {
    setBusy(true);
    void postStaffAction(stationId, action).finally(() => {
      setBusy(false);
      refresh();
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ink px-12 py-8 font-display text-board-text">
      {offline && !board && <p className="text-[32px]">{t(LANG, "board.unavailable")}</p>}
      {board && (
        <>
          <header className="flex items-baseline justify-between gap-8">
            <h1 className="text-[64px] leading-none font-bold">{board.name}</h1>
            <span className="text-[48px] font-semibold tabular-nums">{clockTime(board.now)}</span>
            <span className="flex items-center gap-3 text-[28px] font-semibold">
              <span aria-hidden className={`size-4 ${ZONE_BG[board.zone]}`} />
              {t(LANG, "board.level_zone", {
                floor: board.floor,
                zone: t(LANG, `zone.${board.zone}`),
              })}
            </span>
          </header>

          <table className="mt-10 w-full border-collapse text-left text-[30px]">
            <caption className="sr-only">{t(LANG, "board.arriving")}</caption>
            <thead>
              <tr className="text-[24px] text-board-text/70">
                <th scope="col" className="pb-3 font-semibold">
                  {t(LANG, "board.arriving")}
                </th>
                <th scope="col" className="pb-3 font-semibold">
                  {t(LANG, "board.eta")}
                </th>
                <th scope="col" className="pb-3 font-semibold">
                  {t(LANG, "board.status")}
                </th>
                <th scope="col" className="pb-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {board.arriving.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3">
                    {t(LANG, "board.empty")}
                  </td>
                </tr>
              )}
              {visibleRows(board).map((row) => (
                <tr key={row.key} className={row.simulated ? "text-board-text/60" : ""}>
                  <td className="py-2 font-semibold">
                    {row.initials}
                    <span className="ml-4 text-[24px]">
                      {t(LANG, "board.ticket", { number: row.ticket })}
                    </span>
                  </td>
                  <td className="py-2 tabular-nums">{clockTime(row.eta)}</td>
                  <td className="py-2">{statusWords(row)}</td>
                  <td className="py-2 text-right">
                    {!row.simulated && row.journey_id && row.order_id && (
                      <RowActions row={row} disabled={busy} onAct={act} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-auto flex items-end justify-between gap-8 pt-8">
            <div className="flex items-end gap-6">
              <p className="text-[28px] font-semibold">
                {t(LANG, "board.waiting_now")}{" "}
                <span className="text-[56px] leading-none font-bold tabular-nums">
                  {board.waiting_now}
                </span>
              </p>
              <div className="flex flex-col">
                <QueueSpark
                  counts={board.series.map((s) => s.count)}
                  className="stroke-board-text"
                />
                <span className="text-[18px] text-board-text/70">{t(LANG, "board.last_30")}</span>
              </div>
            </div>
            <p className="max-w-[32ch] text-right font-sans text-[15px] text-board-text/70">
              {t(LANG, "board.source_sim")}
            </p>
          </div>

          {board.tasks.length > 0 && (
            <ul className="mt-6 -mx-12 -mb-8">
              {board.tasks.map((task) => (
                <TaskRow key={task.key} task={task} disabled={busy} onAct={act} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RowActions({
  row,
  disabled,
  onAct,
}: {
  row: BoardRow;
  disabled: boolean;
  onAct: (a: StaffAction) => void;
}) {
  const ids = { journey_id: row.journey_id ?? "", order_id: row.order_id ?? "" };
  return (
    <span
      role="group"
      aria-label={t(LANG, "board.actions_for", { ticket: row.ticket })}
      className="inline-flex gap-3"
    >
      {row.status !== "in_service" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAct({ action: "start", ...ids })}
          className={`${BUTTON} bg-board-text text-ink`}
        >
          {t(LANG, "board.start")}
        </button>
      )}
      {row.status === "in_service" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAct({ action: "done", ...ids })}
          className={`${BUTTON} bg-board-text text-ink`}
        >
          {t(LANG, "board.done")}
        </button>
      )}
      {row.status === "walking" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAct({ action: "didnt_arrive", ...ids })}
          className={`${BUTTON} text-board-text underline underline-offset-4`}
        >
          {t(LANG, "board.didnt_arrive")}
        </button>
      )}
    </span>
  );
}

function TaskRow({
  task,
  disabled,
  onAct,
}: {
  task: BoardTask;
  disabled: boolean;
  onAct: (a: StaffAction) => void;
}) {
  const text =
    task.kind === "lost"
      ? (task.minutes ?? 0) >= 1
        ? t(LANG, "board.lost", { ticket: task.ticket, minutes: task.minutes ?? 0 })
        : t(LANG, "board.lost_now", { ticket: task.ticket })
      : task.kind === "handoff"
        ? t(LANG, "board.handoff", { initials: task.initials, ticket: task.ticket })
        : `${task.initials} ${t(LANG, "board.ticket", { number: task.ticket })}: ${task.reason}`;
  const button =
    task.kind === "lost"
      ? {
          label: t(LANG, "board.send_help"),
          action: { action: "send_help", journey_id: task.journey_id } as const,
        }
      : {
          label:
            task.kind === "handoff" ? t(LANG, "board.mark_called") : t(LANG, "board.task_done"),
          action: { action: "resolve_task", review_id: task.review_id ?? "", by: STAFF } as const,
        };
  return (
    <li className="flex items-center justify-between gap-6 bg-held-bg px-12 py-4 text-[28px] text-held">
      <span className="font-semibold">{text}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAct(button.action)}
        className={`${BUTTON} bg-held text-held-bg`}
      >
        {button.label}
      </button>
    </li>
  );
}
