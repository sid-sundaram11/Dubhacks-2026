# SAM3 segmentation service

Standalone HTTP service for **Person 2** (`server/sam3Client.ts`). The Expo app never calls this directly.

Default URL: **`http://127.0.0.1:8790`** — set on the Node server as:

```bash
SAM3_URL=http://127.0.0.1:8790
```

Person 2 downsamples the returned mask to **48×48** (`MASK_SIZE` in `src/domain/constants.ts`). This service returns a full-resolution mask at the processed image size (long edge capped at **768px**, matching the client photo picker).

## Prerequisites

- Python **3.12+** recommended (3.10+ may work)
- [Request access](https://huggingface.co/facebook/sam3) to `facebook/sam3` on Hugging Face
- Authenticate: set `HF_TOKEN` in `.env` (loaded automatically on startup), or run `hf auth login`

## Install

```bash
cd services/sam3
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit HF_TOKEN if needed
```

## Run

```bash
source .venv/bin/activate
python app.py
# or: uvicorn app:app --host 0.0.0.0 --port 8790
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8790` | Listen port |
| `SAM3_DEVICE` | `auto` | `auto`, `cuda`, `mps`, or `cpu` |
| `SAM3_MODEL_ID` | `facebook/sam3` | Hugging Face model id |
| `SAM3_DEFAULT_PROMPT` | `object` | Text prompt when request omits `prompt` |
| `HF_TOKEN` | (empty) | Optional; uses CLI login if unset |

On Apple Silicon, `auto` selects **MPS** when available. Set `PYTORCH_ENABLE_MPS_FALLBACK=1` if you hit unsupported MPS ops.

### Latency (rough)

| Device | First request (cold) | Warm |
|--------|----------------------|------|
| CUDA (16GB+) | ~5–15s load + ~1–3s | ~1–3s |
| MPS (Apple Silicon) | ~30–120s load + ~5–15s | ~5–15s |
| CPU | Very slow | Often **>16s** per image |

Node uses `GENERATION_ATTEMPT_MS` (**45000**). CPU-only SAM3 may still time out; prefer GPU/MPS for hackathon demos.

### Out of memory

If inference OOMs, `POST /segment` returns **503** `{ "error": "out_of_memory" }`. The process stays up; restart after freeing GPU memory.

## API

### `GET /health`

**200** when the model is loaded:

```json
{ "ok": true }
```

**503** when the model failed to load:

```json
{ "ok": false, "error": "model_unavailable" }
```

### `POST /segment`

**Request**

```json
{
  "mimeType": "image/jpeg",
  "data": "<base64, no data: prefix>",
  "prompt": "optional text for SAM3"
}
```

- `mimeType`: `image/jpeg` or `image/png`
- `data`: raw base64 of the image bytes (same shape as Expo `SubjectImage.data`)
- `prompt`: optional; defaults to `SAM3_DEFAULT_PROMPT` (`object`)

**Response 200**

```json
{
  "width": 512,
  "height": 384,
  "mask": "<base64 PNG, single channel>",
  "label": "dog",
  "confidence": 0.91
}
```

- **`mask`**: PNG, mode `L`, pixels **0** (background) or **255** (subject). Decode in Node with any PNG library; treat values **≥ 127** (or **≥ 0.5** after scaling to 0–1) as foreground **1**.
- **`label`**: text prompt actually used (for Person 3 copy).
- **`confidence`**: SAM3 score for the chosen instance.

**Main subject policy**

1. Run SAM3 with the text prompt.
2. Among instances with score ≥ **0.5**, pick the **largest mask area**.
3. Binarize at 0.5, then keep the **largest connected component**.

**Errors** (JSON `{ "error": "<code>" }`, no stack traces)

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `invalid_mime`, `invalid_base64`, `invalid_image` | Bad input |
| 413 | `payload_too_large` | Decoded image > 8MB |
| 422 | `no_subject` | No qualifying mask |
| 503 | `model_unavailable`, `out_of_memory` | Model not ready or OOM |
| 500 | `segmentation_failed` | Other inference failure |

## Examples

```bash
# Health
curl -s http://127.0.0.1:8790/health | jq .

# Segment (fixture)
B64=$(base64 < fixtures/subject.png | tr -d '\n')
curl -s -X POST http://127.0.0.1:8790/segment \
  -H 'Content-Type: application/json' \
  -d "{\"mimeType\":\"image/png\",\"data\":\"$B64\",\"prompt\":\"circle\"}" | jq '{width,height,label,confidence,mask: (.mask | length)}'
```

## Tests

No checkpoint required for unit/HTTP tests:

```bash
pip install -r requirements.txt
pytest test_segment.py -q
```

Manual end-to-end segmentation needs Hugging Face access and a successful model load.

## Node integration notes

Aligns with [docs/hackathon/sam3/person-2-node-bridge.md](../../docs/hackathon/sam3/person-2-node-bridge.md):

- Call `POST {SAM3_URL}/segment` with the same `mimeType` / `data` as the client image.
- Resize mask to 48×48 (nearest-neighbor or area threshold).
- If mask is empty after resize → `502 generation_failed`.
- Pass `label` into `nameAndStoryForSegmentation`.
