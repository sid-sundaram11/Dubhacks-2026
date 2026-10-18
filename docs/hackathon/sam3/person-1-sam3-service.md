# Person 1 — SAM3 segmentation service

**Branch:** `feat/sam3-service`  
**You own:** `services/sam3/**` only (new directory)  
**Do not edit:** `server/`, `src/`, `package.json`, `app.json`, root `README.md` (Person 4 updates runbook)

---

## Agent context

You are working on **dubhacks-2026**, an Expo app that turns a **photo of a subject** into a **constellation** drawn between real HYG stars. Today the Node server calls **Gemini** to return a 48×48 binary mask plus name/story. This task **replaces Gemini’s mask** with **SAM3** (Segment Anything Model 3 or the team’s chosen SAM3 build) running as a **separate inference service**.

The mobile app never talks to SAM3 directly. Person 2’s Node code will HTTP-call your service. Your job is a reliable, documented **segmentation API** that returns a **foreground mask** for the main subject.

### Product constraints (from `AGENTS.md`)

- No camera preview or AR in the app (unchanged).
- API keys for cloud models stay server-side only; if SAM3 needs credentials, document them in `services/sam3/README.md`, not in the Expo app.
- Do not commit `.env.local` or large datasets.

### Downstream contract (what Person 2 needs from you)

Person 2 will resize your mask to **`MASK_SIZE = 48`** (`src/domain/constants.ts`). You should return the **best-quality mask you can** at a reasonable resolution (e.g. same as input long edge up to 768px, or native SAM output). Document:

- Request format (JSON base64 image vs raw multipart).
- Response format (PNG mask, RLE, or `height × width` array of 0/1).
- Whether alpha / threshold is applied (recommend: **1 = subject, 0 = background**).
- Latency on CPU vs GPU and minimum hardware.

Optional response fields Person 2 may use for copy (Person 3):

- `label` or `prompt` string (e.g. detected class name).
- `confidence` (number).

---

## Goals

1. **Load SAM3** once at startup; handle OOM gracefully with a clear error body.
2. **`POST /segment`** (or team-agreed path) accepts an image and returns a **single-subject** binary mask.
3. **Main subject policy:** document one approach:
   - Text prompt (if SAM3 supports it), e.g. `"main subject"`, or
   - Largest connected component after thresholding, or
   - User-provided prompt field in the request (optional for hackathon).
4. **`services/sam3/README.md`** with install, env vars, `curl` example, and expected response sample.
5. **Health check** `GET /health` returning `{ "ok": true }` for Person 2 and Person 4.

---

## Suggested layout

```
services/sam3/
  README.md
  requirements.txt   # or environment.yml / Dockerfile
  app.py             # FastAPI/Flask entry
  segment.py         # inference wrapper
  .env.example       # SAM3_CHECKPOINT, DEVICE, PORT
```

Use **port** default `8790` unless the team agrees otherwise (Node uses `8787`).

---

## API sketch (align with Person 2 before coding)

**Request** `POST /segment`

```json
{
  "mimeType": "image/jpeg",
  "data": "<base64>",
  "prompt": "optional text for SAM3"
}
```

**Response** `200`

```json
{
  "width": 512,
  "height": 512,
  "mask": "<base64 PNG single channel OR flat 0/1 array>",
  "label": "optional short noun phrase"
}
```

**Errors:** `4xx` bad input, `5xx` model failure with `{ "error": "..." }` (no stack traces in production).

---

## Acceptance criteria

- [ ] Service starts and answers `GET /health`.
- [ ] `POST /segment` on a sample photo returns a mask where the subject occupies a plausible fraction of pixels (not empty, not full frame unless subject fills frame).
- [ ] README documents how Person 2 sets `SAM3_URL=http://127.0.0.1:8790`.
- [ ] No changes outside `services/sam3/**`.

---

## Testing (your responsibility)

- Unit or script test with **one committed small fixture** under `services/sam3/fixtures/` (tiny PNG, &lt; 50KB) or download script documented in README.
- Manual: time one request cold start vs warm.

---

## Merge coordination

- Merge **after** team agrees on request/response JSON in `docs/hackathon/sam3/person-2-node-bridge.md` (Contract section).
- Person 2 integrates; you do **not** edit `server/handler.ts`.

---

## Agent instructions (copy-paste)

```
You are Person 1 on dubhacks-2026. Implement SAM3 as a standalone Python (or agreed) service under services/sam3/ only. Expose POST /segment and GET /health. Return a binary foreground mask for the main subject; document the API for Node. Do not modify server/ or src/. Follow services/sam3/README.md for all ops. Match the request/response sketch in docs/hackathon/sam3/person-1-sam3-service.md and sync with person-2-node-bridge.md.
```
