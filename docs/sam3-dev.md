# SAM3 local development

Three processes for photo → constellation generation:

| Terminal | Command | Port |
|----------|---------|------|
| 1 — SAM3 | `cd services/sam3 && source .venv/bin/activate && python app.py` | 8790 |
| 2 — Node API | `npm run server` | 8787 |
| 3 — Expo | `npx expo start` | (simulator) |

## Prerequisites

- Node dependencies: `npm install`
- SAM3 Python env: see [services/sam3/README.md](../services/sam3/README.md) (Hugging Face access to `facebook/sam3`, `HF_TOKEN` or `huggingface-cli login`)
- Root `.env.local`:

```bash
SAM3_URL=http://127.0.0.1:8790
```

The Expo app only needs `EXPO_PUBLIC_API_BASE` if the Node server is not at `http://127.0.0.1:8787`.

## Health checks

```bash
curl -s http://127.0.0.1:8790/health | jq .
curl -s -X POST http://127.0.0.1:8787/api/generate-constellation \
  -H 'content-type: application/json' \
  -d '{"image":{"mimeType":"image/jpeg","data":"'"$(base64 < path/to/photo.jpg | tr -d '\n')"'"},"prompt":"dog"}' | jq .
```

- **503 `segmentation_unavailable`** — SAM3 not running or model failed to load.
- **502 `generation_failed`** — empty mask, invalid strokes, or snap failure.
- **“The drawing server is not running.”** — Node on 8787 is down (client cannot connect).

Generation timeout is **45s** (`GENERATION_ATTEMPT_MS`). CPU-only SAM3 is often too slow; use Apple MPS or CUDA for demos.

## App usage

1. Pick a photo from the library.
2. Optionally enter **Subject in the photo** (e.g. `dog`, `person`). Empty uses SAM3 default prompt `object`.
3. Generate. The server segments with SAM3, skeletonizes the 48×48 mask, and snaps strokes to visible HYG stars.

## Manual QA checklist

- [ ] Person on a plain background
- [ ] Animal with a specific prompt (`cat`, `dog`)
- [ ] Object on a cluttered background (prompt helps)
- [ ] SAM3 stopped → status mentions segmentation service
- [ ] Node stopped → status mentions drawing server
- [ ] Zoom out if generation asks for more sky candidates

Hackathon task breakdown: [docs/hackathon/sam3/](hackathon/sam3/).
