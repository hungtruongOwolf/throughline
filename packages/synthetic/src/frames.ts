/**
 * Camera frame bank (spec 10.1, `frames.ts`): prompts for Muse Image, one scene per waiting
 * area, a spread of people counts, and variations so no two prompts are identical. SAM 3.1
 * re-counts every frame and that count is the label; the prompt count is only a target.
 */
export interface CameraSpec {
  camera_id: string;
  node_id: string;
  scene: string;
  /** Highest target count in the bank. */
  max: number;
}

export const CAMERAS: CameraSpec[] = [
  {
    camera_id: "cam-lobby",
    node_id: "mp1.lobby",
    scene: "large hospital main lobby with a welcome desk and rows of chairs",
    max: 16,
  },
  {
    camera_id: "cam-lab",
    node_id: "mp1.lab_wait",
    scene: "outpatient blood draw waiting room with a check-in window and chairs along the walls",
    max: 14,
  },
  {
    camera_id: "cam-imaging",
    node_id: "mp2.imaging_wait",
    scene: "imaging department waiting area outside CT rooms",
    max: 12,
  },
  {
    camera_id: "cam-2a",
    node_id: "cc2.wait_2a",
    scene: "quiet cancer clinic waiting area with armchairs and plants",
    max: 10,
  },
  {
    camera_id: "cam-2b",
    node_id: "cc2.wait_2b",
    scene: "small oncology clinic waiting room with upholstered chairs",
    max: 10,
  },
  {
    camera_id: "cam-infusion",
    node_id: "cc3.infusion_wait",
    scene: "infusion center waiting lounge with recliners and a window",
    max: 8,
  },
];

const VARIATIONS = [
  "morning daylight",
  "overcast light",
  "warm afternoon light",
  "bright overhead lighting",
  "a coat rack in the corner",
  "a water cooler near the wall",
  "a potted plant by the window",
  "a magazine rack",
];

export const FRAMES_PER_CAMERA = 40;

export interface FramePrompt {
  camera_id: string;
  index: number;
  target_count: number;
  prompt: string;
}

export function framePrompts(camera: CameraSpec, perCamera = FRAMES_PER_CAMERA): FramePrompt[] {
  return Array.from({ length: perCamera }, (_, index) => {
    const target = Math.round((index * camera.max) / (perCamera - 1));
    const people =
      target === 0
        ? "empty, no people"
        : `${target} ${target === 1 ? "person" : "people"} seated or standing, seen from behind or far away, faces not visible`;
    const variation = VARIATIONS[index % VARIATIONS.length];
    return {
      camera_id: camera.camera_id,
      index,
      target_count: target,
      prompt:
        `Ceiling-corner security camera photo of a ${camera.scene}, wide angle, ${people}, ` +
        `${variation}, realistic, synthetic scene, no text, no logos, frame ${camera.camera_id}-${index}.`,
    };
  });
}

export interface FrameLabel {
  camera_id: string;
  node_id: string;
  file: string;
  target_count: number;
  /** SAM 3.1 count on the committed (downscaled) image: the label the simulator uses. */
  sam_count: number;
}

/** The frame whose labeled count is nearest the simulated count (spec 10.1). */
export function nearestFrame(
  labels: FrameLabel[],
  cameraId: string,
  count: number,
): FrameLabel | undefined {
  let best: FrameLabel | undefined;
  for (const l of labels) {
    if (l.camera_id !== cameraId) continue;
    if (!best || Math.abs(l.sam_count - count) < Math.abs(best.sam_count - count)) best = l;
  }
  return best;
}
