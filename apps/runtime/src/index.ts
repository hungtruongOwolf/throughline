import { serve } from "@hono/node-server";
import { assertSyntheticOnly } from "@throughline/shared";
import { createApp } from "./app";
import { createContext } from "./context";

assertSyntheticOnly(process.env);
const context = createContext(process.env);
const port = Number(process.env.RUNTIME_PORT ?? 4000);
serve({ fetch: createApp(context).fetch, port }, (info) => {
  console.log(
    JSON.stringify({ msg: "runtime listening", port: info.port, sim_now: context.clock.now() }),
  );
});
