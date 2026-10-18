# Agent context — Constellations (dubhacks-2026)

**Read this first** when changing generation, segmentation, skeleton, snapping, or sky UI. [`AGENTS.md`](../AGENTS.md) holds hard constraints; this file describes **current behavior** and **where code lives**.

## Product

Single-screen Expo SDK 58 app (**Constellations** / AI Constellation Creator). User explores a **J2000 HYG star sphere** (touch drag/pinch or optional phone-motion AR; no camera feed). They pick a **photo from the library**, optionally enter **Subject in the photo** (SAM3 text prompt), and generate a **custom constellation**: straight line segments between **real star ids** that approximate a stick figure of the subject.

Manual star-to-star drawing, undo, clear, share PNG, and offline catalog browsing remain supported.

## Three-process local stack

| Process | Path / command | Port |
|---------|----------------|------|
| SAM3 (Python) | `cd services/sam3 && source .venv/bin/activate && python app.py` | 8790 |
| Node API | `npm run server` | 8787 |
| Expo | `npx expo start` | — |

- Root `.env.local`: `SAM3_URL=http://127.0.0.1:8790` (gitignored).
- Hugging Face token: `services/sam3/.env` only—never in Expo or `EXPO_PUBLIC_*`.
- Client default API: `http://127.0.0.1:8787` (`EXPO_PUBLIC_API_BASE` to override).

Runbook detail: [docs/sam3-dev.md](sam3-dev.md).

## End-to-end pipeline

```text
Photo (≤768px) + optional prompt
  → POST /api/generate-constellation (Node)
  → POST /segment (SAM3): mask PNG + label + confidence + optional RGBA overlay
  → downsample mask to MASK_SIZE grid (area threshold)
  → cutoutSubjectPng: RGBA subject from original photo + mask (found stage)
  → morph cleanup → Zhang–Suen skeleton → branch trace → polyline fit → strokes
  → JSON { name, story, strokes, stages?, debug? }
  → Expo snapStrokesToStars → HYG segment pairs → render on sky
```

### Stage images (`stages`)

Base64 PNGs returned on success (also used in UI):

| Key | Meaning |
|-----|---------|
| `found` | Subject cutout (original RGB, transparent background) |
| `mask` | SAM3 grayscale mask at service resolution |
| `grid` | Downsampled `MASK_SIZE` binary grid visualization |
| `skeleton` | Thinned medial axis on grid |
| `nodes` | Skeleton + fitted stroke geometry / nodes |

The globe menu contains an opt-in **Generation details** section with the trace and stage thumbnails. Nothing from generation is shown by default on the sky.

### Debug payload (`debug`)

Structured counts: SAM3 metadata, `maskGrid`, skeleton endpoint/junction/stroke counts, final `strokes`, name/story. Optional on the wire; client schema treats `stages` and `debug` as optional for backward compatibility.

## Key constants (`src/domain/constants.ts`)

- **`MASK_SIZE = 96`** — skeleton/mask grid (was 48; higher resolution preserves thin limbs). All server tests and `maskResponseSchema` use this size.
- **`SNAP_RADII`** — tiered normalized radii for star matching: `[0.08, 0.14, 0.22, 0.35]`.
- **`FOV_MIN = 25`** — generation snapping uses a fixed “min zoom” candidate window so constellation angular size is stable.
- **`CANDIDATE_MIN = 40`** — if too few stars in view, client returns `zoom-out`.
- **Timeouts:** Node allows 120s for SAM3 inference; the device request allows 135s.

## Server (`server/`)

| Module | Role |
|--------|------|
| `handler.ts` | `POST /api/generate-constellation`; CORS; calls `segmentSubject`, `strokesFromMask`, `buildPipelineStagePngs`, `buildServerGenerationDebug` |
| `segmentation/segmentSubject.ts` | SAM3 client, downsample, copy, `foundPng` cutout |
| `segmentation/cutoutSubject.ts` | Cookie-cutter RGBA PNG from uploaded image + mask |
| `segmentation/copy.ts` | Deterministic name/story from SAM3 `label` / prompt (no LLM) |
| `segmentation/downsampleMask.ts` | Full-res mask → `MASK_SIZE` grid |
| `sam3Client.ts` | HTTP to `SAM3_URL` |
| `skeleton.ts` | Morphology, skeletonize, graph branches, TLSQ polyline fit → `GeneratedStroke[]` |
| `debugStages.ts` | Renders pipeline PNGs for `stages` |

### Skeleton / segment policy (current)

- **No** `MAX_SEGMENTS` / `MIN_SEGMENTS` trimming—full branch output is kept.
- Branch endpoints use **shared representative pixels** at junctions so adjacent fitted strokes meet at identical coordinates (avoids “floating” segments in star space).
- Empty or invalid mask → `502 generation_failed`.

## Client (`src/`)

| Module | Role |
|--------|------|
| `shell/SkyScreen.tsx` | Landing screen and immersive sky; globe opens native menu with session history and generation |
| `shell/appReducer.ts` | State; `sessionConstellations`, `generationProbe`, `recall_constellation` |
| `features/constellation/createConstellation.ts` | API call + snap; builds `GenerationTrace` |
| `features/constellation/snapStrokesToStars.ts` | Map stroke points to stars; **consecutive points must not share the same star** (`avoid` alternate pick) |
| `features/starfield/SkyView.tsx` | WebGL sky; tap on constellation lines toggles subject overlay |
| `features/starfield/picking.ts` | `hitConstellation`, `constellationBounds` for overlay placement |
| `features/starfield/skyController.ts` | **Only** sky aim quaternion (touch, room focus, and DeviceMotion via `setAim`) |

### Session constellations

`sessionConstellations: SavedConstellation[]` stores each generated figure plus `subjectPng` (base64 cutout). **This session** chip row recalls prior constellations without losing the sky drawing.

### Subject overlay

Tap a visible constellation segment (not manual-only star pick) to toggle a **native `Image` overlay** at ~**0.38 opacity**, positioned from `constellationBounds`, showing the **cutout** (`found` PNG), not the full photo.

## SAM3 service (`services/sam3/`)

- `POST /segment` — base64 image + optional `prompt` (default `object`).
- Returns mask PNG, `label`, `confidence`, optional `overlay` (RGBA preview).
- Node prefers **`cutoutSubjectPng`** from the original upload for `found`; falls back to SAM3 overlay on decode failure.

See [services/sam3/README.md](../services/sam3/README.md).

## Segmentation bridge

See [server/segmentation/README.md](../server/segmentation/README.md).

## Tests

- `npm test` — Vitest (client + server).
- `services/sam3` — `pytest` (no GPU required for HTTP/unit tests).

When changing `MASK_SIZE`, update fixtures that build all-zero or patterned grids in `server/*.test.ts`, `server/segmentation/*.test.ts`, and `src/test/domain.test.ts`.

## What not to do

- Do not add a second sky rotation path beside `SkyController`.
- Do not put SAM3 / HF credentials in the Expo app.
- Do not commit `hygdata_v42.csv` or `.env.local`.
- Do not reintroduce Gemini mask generation or placeholder “generic star” shapes on failure.

## Doc map

| File | Audience |
|------|----------|
| [AGENTS.md](../AGENTS.md) | Short rules for all agents |
| [README.md](../README.md) | Clone, run, test |
| [description.md](../description.md) | Product narrative |
| [docs/sam3-dev.md](sam3-dev.md) | Local SAM3 + Node + Expo |
| [docs/ui-design.md](ui-design.md) | Visual / layout intent |

Historical hackathon “Person 1–4” task splits were removed; this file replaces them.

## Immersive sky and motion

- Opening screen: title, optional room code with join arrow, Solo, AR toggle. No automatic room restore on launch.
- `WelcomeScreen.tsx`, `MotionToggle.tsx`, `GlobeMenuButton.tsx` hold the entry UI and rotating Earth menu.
- All editing, image generation, rooms, zoom/reset, sharing, star names, and debug controls live inside the globe menu. Names default off.
- `deviceAttitude.ts` converts native device angles to a calibrated relative quaternion. `useDeviceAim.ts` manages availability, permission, background cleanup, no-reading fallback, and recalibration. Motion pauses while the menu is open or generation locks the sky.
- AR follows phone rotation relative to the view at activation; it does not align the sky to geographic north, GPS, or local sidereal time.
- `skyAtmosphere.ts` adds procedural galactic dust aligned to the J2000 plane, not a photographic survey. Stars and constellation vertices still use HYG positions.
- Exact DJORE font is not bundled: a licensed font file is required. Current display fallback is Didot on iOS and native serif elsewhere.
- Native packages `expo-sensors` and `@expo/ui` require a rebuilt development client.
