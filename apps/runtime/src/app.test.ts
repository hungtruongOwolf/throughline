import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("runtime app", () => {
  it("answers /health", async () => {
    const res = await createApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, synthetic: true });
  });
});
