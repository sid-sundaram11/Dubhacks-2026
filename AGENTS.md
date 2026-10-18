# AI Constellation Creator

Expo SDK 58 **single-screen** app. One celestial view—not Expo Router, not a web PWA.

## Hard constraints

- The sky is a dark **J2000 HYG star sphere**. No camera preview, ARKit, ARCore, or camera texture. Optional AR mode uses Expo DeviceMotion through `SkyController.setAim`; it is a motion-controlled star sky, with no camera feed.
- **`SkyController`** (`src/features/starfield/skyController.ts`) is the **only** sky aim. Touch and the calibrated device-attitude adapter write its quaternion. Never introduce a second rotation path.
- Constellation segments are **HYG id pairs**; screen position is always derived from the catalog + aim.
- **SAM3** runs in `services/sam3/` (port **8790**). Node calls it via **`SAM3_URL`** in root `.env.local`. Hugging Face credentials stay in **`services/sam3/.env` only**—never in the Expo app or `EXPO_PUBLIC_*`.
- Do not commit `hygdata_v42.csv` or `.env.local`.

## Current architecture (summary)

Photo → Node `POST /api/generate-constellation` → SAM3 mask → **`MASK_SIZE` 96** grid (`src/domain/constants.ts`) → skeleton → strokes → client **snap to visible stars** → render lines on the sphere.

Generation returns optional **`stages`** (pipeline PNGs) and **`debug`** (structured trace). UI shows session history, a generation trace panel, bottom stage thumbnails, and tap-to-toggle **subject cutout** overlay on the constellation.

Full file map, pipeline stages, and snapping rules: **[docs/agent-context.md](docs/agent-context.md)**.

## Local run

```bash
npm run server          # 8787 — needs SAM3_URL in .env.local
# services/sam3 on 8790 — see services/sam3/README.md
npx expo start
```

Details: [docs/sam3-dev.md](docs/sam3-dev.md).
