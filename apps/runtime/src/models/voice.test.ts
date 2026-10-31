import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { createContext } from "../context";
import { seedReferral } from "../demo/referral";

const WAV = readFileSync(new URL("../../../../fixtures/voice/maria-reply.wav", import.meta.url));

afterEach(() => vi.unstubAllGlobals());

describe("voice reply (D3-4)", () => {
  it("a voice note becomes PatientReplied with the transcript, like a typed reply", async () => {
    const calls: { url: string; request: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const form = init.body as FormData;
      calls.push({ url, request: JSON.parse(await (form.get("request") as Blob).text()) });
      return new Response(
        JSON.stringify({ transcript: "Yes, I'll be there. But my husband can't come." }),
        { status: 200 },
      );
    });
    const ctx = createContext({}, { databasePath: ":memory:" });
    await seedReferral(ctx);
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(WAV)], { type: "audio/wav" }), "note.wav");
    const res = await createApp(ctx).request("/api/journeys/maria-001/voice", {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toMatch(/\/asr\/transcribe$/);
    expect(calls[0]?.request).toMatchObject({
      audioEncoding: "WAV",
      model: "muse-voice-transcribe-1.0",
    });
    const reply = ctx.store.events().find((e) => e.event.type === "PatientReplied")?.event;
    expect(reply?.payload).toMatchObject({
      channel: "voice_sim",
      transcript: "Yes, I'll be there. But my husband can't come.",
    });
    expect(ctx.store.modelCalls().some((r) => r.model === "muse-voice-transcribe-1.0")).toBe(true);
  });
});
