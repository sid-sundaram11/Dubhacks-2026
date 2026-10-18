# Node segmentation bridge

The Expo client posts `{ image, prompt? }` to the Node API. This module calls SAM3 and returns a validated 48×48 mask plus name/story.

## Environment

```bash
SAM3_URL=http://127.0.0.1:8790
```

Set in `.env.local` at the repo root (loaded by `server/index.ts`).

## Downsampling

SAM3 returns a full-resolution grayscale PNG (0 = background, 255 = subject). `downsampleMaskToGrid` maps it to `MASK_SIZE` (48) with **area thresholding**: each cell is `1` when at least half of the source pixels in that cell are foreground (value ≥ 127).

If the grid is empty after downsampling, the handler returns `502 generation_failed`.

## Copy

`copy.ts` supplies deterministic name and story from the SAM3 `label` (text prompt used). No Gemini or other network calls.
