import { describe, expect, it } from "vitest";
import { SimClock } from "./sim-clock";

describe("SimClock", () => {
  it("keeps the campus offset in its output", () => {
    const clock = new SimClock("2026-11-17T09:12:00-06:00");
    expect(clock.now()).toBe("2026-11-17T09:12:00-06:00");
  });

  it("fires timers in time order, including timers scheduled by timers", async () => {
    const clock = new SimClock("2026-11-17T09:00:00-06:00");
    const fired: string[] = [];
    clock.after(30, "b", () => void fired.push(`b@${clock.now()}`));
    clock.after(10, "a", () => {
      fired.push(`a@${clock.now()}`);
      clock.after(5, "a2", () => void fired.push(`a2@${clock.now()}`));
    });
    clock.after(120, "later", () => void fired.push("later"));
    await clock.advanceBy(60);
    expect(fired).toEqual([
      "a@2026-11-17T09:10:00-06:00",
      "a2@2026-11-17T09:15:00-06:00",
      "b@2026-11-17T09:30:00-06:00",
    ]);
    expect(clock.now()).toBe("2026-11-17T10:00:00-06:00");
    expect(clock.pending().map((t) => t.label)).toEqual(["later"]);
  });

  it("jumps to the next beat and supports cancel", async () => {
    const clock = new SimClock("2026-11-13T17:00:00-06:00");
    const id = clock.after(5, "cancelled", () => {
      throw new Error("should not fire");
    });
    clock.at("2026-11-14T08:00:00-06:00", "labs", () => undefined);
    clock.cancel(id);
    await clock.jumpToNext();
    expect(clock.now()).toBe("2026-11-14T08:00:00-06:00");
  });
});
