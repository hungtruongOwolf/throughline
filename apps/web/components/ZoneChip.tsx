import type { Zone } from "@throughline/hospital";
import { t, type Language } from "@throughline/shared";
import { ZONE_BG, ZONE_TINT } from "../lib/zone-classes";

/** "Level 2, Gold Zone": a tinted chip with a solid zone square; text stays ink for contrast. */
export function ZoneChip({ zone, floor, lang }: { zone: Zone; floor: number; lang: Language }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[6px] px-2.5 py-1 text-[15px] text-ink ${ZONE_TINT[zone]}`}
    >
      <span aria-hidden className={`size-2.5 ${ZONE_BG[zone]}`} />
      {t(lang, "patient.level_zone", { floor, zone: t(lang, `zone.${zone}`) })}
    </span>
  );
}
