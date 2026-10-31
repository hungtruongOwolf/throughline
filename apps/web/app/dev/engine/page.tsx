import { EngineProbe } from "./probe";

export const metadata = { title: "Engine probe · Throughline" };

/** Internal page: proves the Rust engine runs as WASM in the browser (D1-3). */
export default function EnginePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-[40px] font-bold">Engine probe</h1>
      <EngineProbe />
    </main>
  );
}
