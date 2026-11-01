# Throughline film

The product video, built with [Remotion](https://www.remotion.dev) (free license for individuals).
Kept outside the pnpm workspace; install with npm.

```sh
npm install
bash scripts/sfx.sh                # sound effects and music beds (ffmpeg)
# narration: one WAV per paragraph of narration.json in public/audio/vo/pNN.wav, then
node scripts/timing.mjs            # scene lengths follow the voice
# real product shots (app running locally in replay mode)
node scripts/capture.mjs stills && node scripts/capture.mjs r2 && node scripts/still3d.mjs northgate
NODE_OPTIONS="--require ../scripts/exfat-fs-patch.cjs" npx remotion studio src/index.ts
NODE_OPTIONS="--require ../scripts/exfat-fs-patch.cjs" npx remotion render src/index.ts Throughline out/throughline.mp4
```

Replacing the files in `public/audio/vo/` with a recorded voice and re-running `timing.mjs` re-times every scene.
