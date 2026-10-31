import { describe, expect, it } from "vitest";
import { CAMERAS } from "@throughline/synthetic";
import { CameraBank } from "./cameras";

describe("camera bank (D2-5)", () => {
  const bank = new CameraBank();

  it("has at least 40 SAM-labeled frames for each of the six cameras", () => {
    for (const camera of CAMERAS) {
      expect(
        bank.labels.filter((l) => l.camera_id === camera.camera_id).length,
      ).toBeGreaterThanOrEqual(40);
    }
  });

  it("serves the frame whose labeled count is nearest the simulated count", () => {
    const frame = bank.frame("cam-imaging", 6);
    const counts = bank.labels.filter((l) => l.camera_id === "cam-imaging").map((l) => l.sam_count);
    const best = Math.min(...counts.map((c) => Math.abs(c - 6)));
    expect(Math.abs((frame?.labeled_count ?? 99) - 6)).toBe(best);
    expect(frame?.bytes.length).toBeGreaterThan(1000);
  });

  it("maps waiting-area nodes to cameras", () => {
    expect(bank.cameraFor("mp2.imaging_wait")).toBe("cam-imaging");
  });
});
