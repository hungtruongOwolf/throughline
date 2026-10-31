import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { openDatabase } from "../db/index";
import { ModelCache } from "./cache";
import { modelConfig } from "./config";
import { samCount, SAM_NOUNS, type SamNoun } from "./sam";

describe("SAM guard (spec 11.1: counting, not identifying)", () => {
  it("only person, door, and elevator are ever sent", () => {
    expect([...SAM_NOUNS]).toEqual(["person", "door", "elevator"]);
  });

  it("refuses any other noun before calling the model", async () => {
    const { sqlite } = openDatabase(":memory:");
    const client = { responses: { create: () => Promise.reject(new Error("must not be called")) } };
    await expect(
      samCount(
        {
          client: client as unknown as OpenAI,
          config: modelConfig({}),
          cache: new ModelCache(sqlite, "off"),
          record: () => undefined,
          now: () => "2026-11-17T09:46:00-06:00",
        },
        { bytes: Buffer.from(""), mime: "image/webp" },
        "face" as SamNoun,
      ),
    ).rejects.toThrow("SAM noun not allowed");
  });
});
