import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/index";
import { CacheMiss, ModelCache } from "./cache";

describe("model cache (test 13)", () => {
  const request = { model: "muse-spark-1.3", input: [{ role: "user", content: "hi" }] };

  it("record calls the provider once per request hash, then serves the recording", async () => {
    const { sqlite } = openDatabase(":memory:");
    const cache = new ModelCache(sqlite, "record");
    let live = 0;
    const call = () =>
      cache.call("meta", "muse-spark-1.3", request, () => Promise.resolve({ n: ++live }));
    expect(await call()).toEqual({ value: { n: 1 }, replayed: false });
    expect(await call()).toEqual({ value: { n: 1 }, replayed: true });
    expect(live).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("replay returns the recorded response and marks it replayed", async () => {
    const { sqlite } = openDatabase(":memory:");
    await new ModelCache(sqlite, "record").call("meta", "muse-spark-1.3", request, () =>
      Promise.resolve({ text: "recorded" }),
    );
    const replay = new ModelCache(sqlite, "replay");
    const result = await replay.call(
      "meta",
      "muse-spark-1.3",
      { input: request.input, model: request.model },
      () => Promise.reject(new Error("must not call the provider in replay")),
    );
    expect(result).toEqual({ value: { text: "recorded" }, replayed: true });
  });

  it("replay never calls the provider on a miss", async () => {
    const { sqlite } = openDatabase(":memory:");
    const replay = new ModelCache(sqlite, "replay");
    await expect(
      replay.call("meta", "muse-spark-1.3", { other: true }, () => Promise.resolve("live")),
    ).rejects.toBeInstanceOf(CacheMiss);
  });
});
