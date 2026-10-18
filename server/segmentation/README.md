# Node segmentation bridge

The Expo client posts `{ image, prompt? }` to the Node API. This module calls SAM3 and returns a validated **`MASK_SIZE` × `MASK_SIZE`** mask plus name/story and assets for pipeline UI.

`MASK_SIZE` is **96** (`src/domain/constants.ts`).

## Environment

```bash
SAM3_URL=http://127.0.0.1:8790
```

Set in `.env.local` at the repo root (loaded by `server/index.ts`).

## Flow (`segmentSubject.ts`)

1. `POST {SAM3_URL}/segment` with the same `mimeType` / `data` as the client image and optional `prompt`.
2. Decode mask PNG; **downsample** to the grid with area thresholding.
3. If the grid is empty → `SegmentSubjectError` → handler `502 generation_failed`.
4. `nameAndStoryForSegmentation` from `copy.ts` (deterministic; no HTTP).
5. **`foundPng`**: `cutoutSubjectPng(image, mask, …)` — RGBA cutout from the **original upload** (transparent background). On failure, fall back to SAM3 `overlay` or raw mask.
6. Return `{ name, story, mask, foundPng, maskPng, sam3 }` for the handler to skeletonize and build `stages`.

## Downsampling

SAM3 returns a full-resolution grayscale PNG (0 = background, 255 = subject). `downsampleMaskToGrid` maps it to `MASK_SIZE` with **area thresholding**: each cell is `1` when at least half of the source pixels in that cell are foreground (value ≥ 127).

## Copy

`copy.ts` supplies deterministic name and story from the SAM3 `label` (text prompt used). No Gemini or other network calls.

See also [docs/agent-context.md](../../docs/agent-context.md).
