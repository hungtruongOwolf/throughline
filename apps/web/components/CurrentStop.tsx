import type { Zone } from "@throughline/hospital";
import { t, type Language } from "@throughline/shared";
import { BigNumber } from "./BigNumber";
import { ZoneChip } from "./ZoneChip";

export interface CurrentStopProps {
  name: string;
  zone: Zone;
  floor: number;
  peopleAhead: number;
  waitMinutes: number;
  lang: Language;
  onShowWay?: () => void;
  onImHere?: () => void;
}

/** The only large thing on the patient screen: where to go now and how long it will take. */
export function CurrentStop({
  name,
  zone,
  floor,
  peopleAhead,
  waitMinutes,
  lang,
  onShowWay,
  onImHere,
}: CurrentStopProps) {
  const ahead =
    peopleAhead === 1
      ? t(lang, "patient.people_ahead_one")
      : t(lang, "patient.people_ahead", { count: peopleAhead });
  // "3 people ahead": the number is set large, the words follow it.
  const words = ahead.replace(/^\d+\s*/, "");
  return (
    <div className="pb-8">
      <h2 className="font-display text-[40px] leading-tight font-bold">{name}</h2>
      <div className="mt-2">
        <ZoneChip zone={zone} floor={floor} lang={lang} />
      </div>
      <div className="mt-6">
        <BigNumber value={peopleAhead} label={words} />
        <p className="mt-1 text-[19px]">
          {Math.round(waitMinutes) <= 1
            ? t(lang, "patient.about_one_minute")
            : t(lang, "patient.about_minutes", { minutes: Math.round(waitMinutes) })}
        </p>
      </div>
      <div className="mt-6 flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={onShowWay}
          className="min-h-12 rounded-[12px] bg-line px-5 text-[17px] font-bold text-paper"
        >
          {t(lang, "patient.show_way")}
        </button>
        <button
          type="button"
          onClick={onImHere}
          className="min-h-12 rounded-[12px] px-1 text-[17px] font-bold text-line"
        >
          {t(lang, "patient.im_here")}
        </button>
      </div>
    </div>
  );
}
