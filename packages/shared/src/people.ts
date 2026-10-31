/** Public boards show initials and a ticket number, never a full name (spec 9.3). */
export function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
}

/** A stable 4-digit ticket number for a journey or patient id. */
export function ticketNumber(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 1000 + (h % 9000);
}
