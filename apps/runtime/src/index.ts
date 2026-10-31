import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.RUNTIME_PORT ?? 4000);
serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(JSON.stringify({ msg: "runtime listening", port: info.port }));
});
