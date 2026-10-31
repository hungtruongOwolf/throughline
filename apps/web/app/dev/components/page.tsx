import type { Zone } from "@throughline/hospital";
import { ItineraryPlan, t, type Language } from "@throughline/shared";
import itineraryFixtures from "../../../../../packages/engine/fixtures/itinerary.json";
import { CurrentStop } from "../../../components/CurrentStop";
import { DeviceFrame } from "../../../components/DeviceFrame";
import { Stop } from "../../../components/Stop";
import { Throughline, type ThroughlineStop } from "../../../components/Throughline";
import { ZoneChip } from "../../../components/ZoneChip";
import { stationDisplay } from "../../../lib/stations";

export const metadata = { title: "Components · Throughline" };

/** Maria's Nov 17 plan from the engine goldens; the first stop is done, the second is current. */
const maria = ItineraryPlan.parse(itineraryFixtures.cases[0]?.expected);

function patientLine(lang: Language): ThroughlineStop[] {
  return maria.stops.map((s, i) => {
    const d = stationDisplay(s.station_id, s.node_id);
    const status = i === 0 ? "done" : i === 1 ? "current" : "future";
    return {
      key: s.order_id,
      zone: d.zone,
      status,
      content:
        status === "current" ? (
          <CurrentStop
            name={d.name}
            zone={d.zone}
            floor={d.floor}
            peopleAhead={s.people_ahead}
            waitMinutes={s.est_wait_min}
            lang={lang}
          />
        ) : (
          <Stop
            name={d.name}
            status={status}
            time={status === "done" ? s.eta_end : s.eta_start}
            lang={lang}
          />
        ),
    };
  });
}

function Phone({ lang }: { lang: Language }) {
  return (
    <DeviceFrame kind="phone" label={`Patient phone, ${lang}`}>
      <div lang={lang} className="flex h-full flex-col bg-paper px-6 pt-12 pb-8 text-[17px]">
        <header className="flex items-baseline justify-between">
          <span className="font-bold">{t(lang, "hospital.name")}</span>
        </header>
        <div className="mt-8 flex-1 overflow-hidden">
          <Throughline stops={patientLine(lang)} label={t(lang, "patient.itinerary_label")} />
        </div>
        <a href="#" className="min-h-12 pt-3 font-bold text-line">
          {t(lang, "patient.talk_to_person")}
        </a>
        <p className="text-[13px] text-ink-soft">{t(lang, "footer.synthetic")}</p>
      </div>
    </DeviceFrame>
  );
}

const PHASES: { label: string; zone?: Zone; status: ThroughlineStop["status"] }[] = [
  { label: "Referral", status: "done" },
  { label: "Booked", status: "done" },
  { label: "Arrived", zone: "blue", status: "done" },
  { label: "CT", zone: "gold", status: "current" },
  { label: "Clinic", zone: "rose", status: "future" },
  { label: "Infusion", zone: "violet", status: "future" },
  { label: "Summary", status: "future" },
  { label: "Closed", status: "future" },
];

const ZONES: Zone[] = ["blue", "gold", "green", "rose", "violet"];

/** Component sheet for design review (D1-8); screenshots go to docs/screens. */
export default function ComponentsPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-12 py-12">
      <h1 className="font-display text-[40px] font-bold">Components</h1>
      <p className="mt-1 text-ink-soft">{t("en", "footer.synthetic")}</p>

      <section className="mt-10">
        <h2 className="font-display text-[28px] font-semibold">The line, Journey Control</h2>
        <div className="mt-6 max-w-[960px]">
          <Throughline
            orientation="horizontal"
            label="Journey phases"
            stops={PHASES.map((p) => ({
              key: p.label,
              zone: p.zone,
              status: p.status,
              content: p.label,
            }))}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[28px] font-semibold">Patient phone, visit day</h2>
        <div className="mt-6 flex flex-wrap gap-12">
          <Phone lang="en" />
          <Phone lang="en" />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[28px] font-semibold">Zone chips</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {ZONES.map((z, i) => (
            <ZoneChip key={z} zone={z} floor={i < 2 ? i + 1 : i - 1} lang="en" />
          ))}
        </div>
      </section>
    </main>
  );
}
