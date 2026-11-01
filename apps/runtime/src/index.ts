import { serve } from "@hono/node-server";
import { assertSyntheticOnly } from "@throughline/shared";
import { createApp, restoreHospital } from "./app";
import { createContext } from "./context";

/** An idle hospital that visitors changed is rebuilt after this long without a change. */
const RESTORE_AFTER_IDLE_MS = 10 * 60_000;

assertSyntheticOnly(process.env);
const context = createContext(process.env);
const port = Number(process.env.RUNTIME_PORT ?? 4000);

// The platform opens on the morning of Nov 17 (demo/population.ts); POPULATE=false starts empty.
if (process.env.POPULATE !== "false") {
  const started = performance.now();
  await restoreHospital(context);
  console.log(
    JSON.stringify({
      msg: "hospital ready",
      ms: Math.round(performance.now() - started),
      sim_now: context.clock.now(),
    }),
  );
  setInterval(() => {
    const { dirty, at } = context.activity;
    if (dirty && Date.now() - at > RESTORE_AFTER_IDLE_MS) void restoreHospital(context);
  }, 60_000).unref();
}

serve({ fetch: createApp(context).fetch, port }, (info) => {
  console.log(
    JSON.stringify({ msg: "runtime listening", port: info.port, sim_now: context.clock.now() }),
  );
});
