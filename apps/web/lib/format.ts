/** "2026-11-17T09:05:00-06:00" → "9:05". Sim times carry the campus offset, so no conversion. */
export function clockTime(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[1])}:${match[2]}`;
}
