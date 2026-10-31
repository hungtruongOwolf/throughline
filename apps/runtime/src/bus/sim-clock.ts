/**
 * The simulated clock (spec 4.5). Every timer in the product (reminders, result turnaround,
 * lost-patient checks, teach-back) is registered here, never against wall time, so the demo
 * can fast-forward three phases in three minutes and replay identically.
 */
export type TimerFn = () => void | Promise<void>;

interface Timer {
  id: number;
  at: number;
  label: string;
  fn: TimerFn;
}

export type ClockSpeed = 1 | 10 | 60 | 600;

export class SimClock {
  private nowMs: number;
  private readonly offsetMin: number;
  private timers: Timer[] = [];
  private nextId = 1;
  private loop: ReturnType<typeof setInterval> | undefined;
  private advancing: Promise<void> = Promise.resolve();
  speed: ClockSpeed = 1;

  /** `start` is an ISO time with offset; output times keep that offset (campus local time). */
  constructor(start: string) {
    this.nowMs = Date.parse(start);
    if (Number.isNaN(this.nowMs)) throw new Error(`bad SIM_START ${start}`);
    const m = /([+-])(\d{2}):(\d{2})$/.exec(start);
    this.offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  }

  nowMsValue(): number {
    return this.nowMs;
  }

  /** Current sim time as ISO with the campus offset, e.g. 2026-11-17T09:12:00-06:00. */
  now(): string {
    return this.format(this.nowMs);
  }

  format(ms: number): string {
    const local = new Date(ms + this.offsetMin * 60_000).toISOString().slice(0, 19);
    const sign = this.offsetMin < 0 ? "-" : "+";
    const abs = Math.abs(this.offsetMin);
    return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  }

  /** Schedules `fn` at an absolute sim time. Returns an id for cancel(). */
  at(when: string | number, label: string, fn: TimerFn): number {
    const at = typeof when === "number" ? when : Date.parse(when);
    const id = this.nextId++;
    this.timers.push({ id, at, label, fn });
    // Stable order: by time, then by registration.
    this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    return id;
  }

  after(minutes: number, label: string, fn: TimerFn): number {
    return this.at(this.nowMs + minutes * 60_000, label, fn);
  }

  cancel(id: number): void {
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  pending(): { at: string; label: string }[] {
    return this.timers.map((t) => ({ at: this.format(t.at), label: t.label }));
  }

  /** Moves time forward, firing due timers in order; timers may schedule more timers. */
  advanceTo(target: string | number): Promise<void> {
    const to = typeof target === "number" ? target : Date.parse(target);
    this.advancing = this.advancing.then(async () => {
      while (this.timers.length > 0 && (this.timers[0] as Timer).at <= to) {
        const timer = this.timers.shift() as Timer;
        this.nowMs = Math.max(this.nowMs, timer.at);
        await timer.fn();
      }
      this.nowMs = Math.max(this.nowMs, to);
    });
    return this.advancing;
  }

  advanceBy(minutes: number): Promise<void> {
    return this.advanceTo(this.nowMs + minutes * 60_000);
  }

  /** Jumps to the next timer (the "skip to next beat" control). */
  async jumpToNext(): Promise<void> {
    const next = this.timers[0];
    if (next) await this.advanceTo(next.at);
  }

  /** Drives the clock from wall time at `speed`. */
  start(speed: ClockSpeed, tickMs = 250): void {
    this.speed = speed;
    this.stop();
    this.loop = setInterval(() => void this.advanceBy((tickMs * this.speed) / 60_000), tickMs);
  }

  stop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = undefined;
  }

  get running(): boolean {
    return this.loop !== undefined;
  }
}
