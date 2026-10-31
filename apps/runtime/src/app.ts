import { Hono } from "hono";
import { cors } from "hono/cors";
import { SHARED_VERSION } from "@throughline/shared";

export function createApp() {
  const app = new Hono();
  app.use("*", cors());
  app.get("/health", (c) => c.json({ ok: true, shared: SHARED_VERSION, synthetic: true }));
  return app;
}
