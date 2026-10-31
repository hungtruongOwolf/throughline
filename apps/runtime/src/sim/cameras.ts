import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nearestFrame, type FrameLabel } from "@throughline/synthetic";

const FRAMES = fileURLToPath(new URL("../../../../packages/synthetic/frames/", import.meta.url));

export interface CameraFrame {
  camera_id: string;
  file: string;
  /** SAM 3.1's count when the bank was labeled; the live call re-counts. */
  labeled_count: number;
  bytes: Buffer;
  mime: "image/webp";
}

/**
 * The simulated cameras (spec 10.1): six waiting areas, each serving the frame from the bank
 * whose labeled count is nearest the simulated count. Frames are synthetic (Muse Image) and
 * are read from disk on demand; nothing a camera "sees" is stored by the runtime.
 */
export class CameraBank {
  readonly labels: FrameLabel[];

  constructor(dir = FRAMES) {
    const path = `${dir}labels.json`;
    this.labels = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as FrameLabel[]) : [];
    this.dir = dir;
  }

  private readonly dir: string;

  get available(): boolean {
    return this.labels.length > 0;
  }

  cameraFor(nodeId: string): string | undefined {
    return this.labels.find((l) => l.node_id === nodeId)?.camera_id;
  }

  frame(cameraId: string, simulatedCount: number): CameraFrame | undefined {
    const label = nearestFrame(this.labels, cameraId, simulatedCount);
    if (!label) return undefined;
    return {
      camera_id: cameraId,
      file: label.file,
      labeled_count: label.sam_count,
      bytes: readFileSync(`${this.dir}${label.file}`),
      mime: "image/webp",
    };
  }
}
