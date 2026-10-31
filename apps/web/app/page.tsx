import { SHARED_VERSION } from "@throughline/shared";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-[40px] font-bold">Throughline</h1>
      <p className="mt-2 text-ink-soft">Halden Medical Center</p>
      <p className="mt-12 text-[13px] text-ink-soft">
        Synthetic demo data. Not a real patient. shared {SHARED_VERSION}
      </p>
    </main>
  );
}
