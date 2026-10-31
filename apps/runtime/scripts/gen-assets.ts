// D2-5: generates the camera frame bank and the sign photos with Muse Image, labels frames with
// SAM 3.1, and records Spark's sign readings for test 22. Resumable: existing files are kept.
//   pnpm --filter @throughline/runtime gen:assets [frames|signs|readings]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { ModelCallRecord } from "@throughline/shared";
import { CAMERAS, DEFAULT_SEED, framePrompts, type FrameLabel } from "@throughline/synthetic";
import {
  composeSignPhoto,
  renderSignPng,
  signsToPhotograph,
  type SignPhotoLabel,
} from "../../../packages/synthetic/src/signs";
import { openDatabase } from "../src/db/index";
import { ModelCache } from "../src/models/cache";
import { modelConfig } from "../src/models/config";
import { generateImage } from "../src/models/image";
import { metaClient } from "../src/models/meta";
import { samCount } from "../src/models/sam";
import { readSign } from "../src/models/vision";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const FRAMES = root("packages/synthetic/frames/");
const SIGNS = root("packages/synthetic/signs/");

const config = modelConfig(process.env);
// Responses are cached in the regular runtime database, so a re-run costs nothing.
const { sqlite } = openDatabase();
const cache = new ModelCache(sqlite, "record");
const calls: ModelCallRecord[] = [];
const deps = {
  client: metaClient(config),
  config,
  cache,
  record: (r: ModelCallRecord) => void calls.push(r),
  now: () => new Date().toISOString(),
};

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

async function frames() {
  const labelsPath = `${FRAMES}labels.json`;
  const labels: FrameLabel[] = existsSync(labelsPath)
    ? (JSON.parse(readFileSync(labelsPath, "utf8")) as FrameLabel[])
    : [];
  const done = new Set(labels.map((l) => l.file));
  const work = CAMERAS.flatMap((camera) => framePrompts(camera).map((p) => ({ camera, p })));
  let n = 0;
  await pool(work, 6, async ({ camera, p }) => {
    const file = `${camera.camera_id}/${String(p.index).padStart(2, "0")}.webp`;
    if (done.has(file)) return;
    mkdirSync(`${FRAMES}${camera.camera_id}`, { recursive: true });
    const image = await generateImage(deps, p.prompt, { capability: "queue.estimate" });
    // Committed at 960×640 to keep the repo small; SAM labels the committed image itself.
    const small = await sharp(image.bytes)
      .resize(960, 640, { fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();
    writeFileSync(`${FRAMES}${file}`, small);
    const counted = await samCount(deps, { bytes: small, mime: "image/webp" }, "person");
    labels.push({
      camera_id: camera.camera_id,
      node_id: camera.node_id,
      file,
      target_count: p.target_count,
      sam_count: counted.count,
    });
    labels.sort((a, b) => a.file.localeCompare(b.file));
    writeFileSync(labelsPath, `${JSON.stringify(labels, null, 2)}\n`);
    console.log(
      `${++n}/${work.length - done.size} ${file} target ${p.target_count} sam ${counted.count}`,
    );
  });
}

const BACKGROUNDS = [
  "Phone photo at eye level of an empty hospital corridor with beige walls and a polished floor, soft ceiling light, no signs, no text, realistic, synthetic scene.",
  "Phone photo at eye level of a hospital hallway near an elevator lobby, plants and benches, no signs, no text, realistic, synthetic scene.",
  "Phone photo at eye level of a bright hospital walkway with large windows, no signs, no text, realistic, synthetic scene.",
];

async function signs() {
  mkdirSync(SIGNS, { recursive: true });
  const backgrounds: Buffer[] = [];
  for (const [i, prompt] of BACKGROUNDS.entries()) {
    const path = `${SIGNS}background-${i}.webp`;
    if (!existsSync(path)) {
      const image = await generateImage(deps, prompt, { capability: "patient.locate" });
      writeFileSync(
        path,
        await sharp(image.bytes)
          .resize(960, 640, { fit: "cover" })
          .webp({ quality: 72 })
          .toBuffer(),
      );
    }
    backgrounds.push(readFileSync(path));
  }
  const labels: SignPhotoLabel[] = [];
  for (const [i, sign] of signsToPhotograph(DEFAULT_SEED).entries()) {
    const file = `${String(i).padStart(2, "0")}.webp`;
    const background = i % backgrounds.length;
    writeFileSync(
      `${SIGNS}${file}`,
      await composeSignPhoto(
        renderSignPng(sign),
        backgrounds[background] as Buffer,
        DEFAULT_SEED,
        i,
      ),
    );
    labels.push({ file, sign_id: sign.sign_id, node_id: sign.node_id, background });
  }
  writeFileSync(`${SIGNS}labels.json`, `${JSON.stringify(labels, null, 2)}\n`);
  console.log(`wrote ${labels.length} sign photos`);
}

async function readings() {
  const labels = JSON.parse(readFileSync(`${SIGNS}labels.json`, "utf8")) as SignPhotoLabel[];
  const out: { file: string; node_id: string; heading: string[]; directions: string[] }[] = [];
  await pool(labels, 6, async (l) => {
    const { reading } = await readSign(deps, {
      bytes: readFileSync(`${SIGNS}${l.file}`),
      mime: "image/webp",
    });
    out.push({ file: l.file, node_id: l.node_id, ...reading });
    console.log(l.file, l.node_id, JSON.stringify(reading.heading));
  });
  out.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(
    root("fixtures/sign-readings.json"),
    `${JSON.stringify({ source: "muse-spark-1.3, recorded live by gen-assets readings", readings: out }, null, 2)}\n`,
  );
}

const which = process.argv[2] ?? "all";
if (which === "frames" || which === "all") await frames();
if (which === "signs" || which === "all") await signs();
if (which === "readings" || which === "all") await readings();
const live = calls.filter((c) => !c.replayed);
console.log(
  `model calls: ${calls.length} (${live.length} live, ${calls.length - live.length} cached)`,
);
