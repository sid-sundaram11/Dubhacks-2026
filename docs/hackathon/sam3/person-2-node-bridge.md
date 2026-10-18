# Person 2 — Node bridge, contract, and handler integration

**Branch:** `feat/sam3-node-bridge`  
**You own:** `server/segmentation/**` (new), `server/sam3Client.ts` (new), `server/handler.ts`, `server/handler.test.ts`; deprecate default path through `server/gemini.ts` (do not delete until SAM works)  
**Do not edit:** `services/sam3/**` (Person 1), `server/segmentation/copy.ts` (Person 3 owns), `src/**` except if Person 4 already merged—prefer zero `src/` changes

---

## Agent context

**dubhacks-2026** flow today:

1. Expo sends `POST /api/generate-constellation` with `{ image: { mimeType, data } }` (base64).
2. [`server/handler.ts`](../../server/handler.ts) calls `generateWithGemini` → JSON string `{ name, story, mask }`.
3. [`maskResponseSchema`](../../src/features/generation/generationSchemas.ts) validates mask: **48 rows × 48 cols**, values `0 | 1`.
4. [`server/skeleton.ts`](../../server/skeleton.ts) `strokesFromMask` → strokes → JSON to client.
5. Client [`createConstellation`](../../src/features/constellation/createConstellation.ts) snaps strokes to stars.

Your job: **replace step 2’s Gemini call** with **SAM3 via Person 1’s HTTP service**, while keeping steps 3–5 unchanged.

### Shared contract (you define this file first — small PR to `main`)

Create [`server/segmentation/contract.ts`](../../server/segmentation/contract.ts):

```ts
import type { SubjectImage } from "../../src/domain/generation";

export interface SegmentationResult {
  name: string;
  story: string;
  mask: number[][]; // MASK_SIZE × MASK_SIZE, values 0 | 1
}

export type SegmentSubject = (image: SubjectImage) => Promise<SegmentationResult>;
```

Re-export `MASK_SIZE` from `src/domain/constants.ts` in docs only; import constant in implementation.

**Name/story:** import from Person 3’s `server/segmentation/copy.ts` — do not duplicate string logic.

---

## Goals

1. **`server/sam3Client.ts`** — HTTP client to `process.env.SAM3_URL` (default `http://127.0.0.1:8790`):
   - Timeouts aligned with `GENERATION_ATTEMPT_MS` (16000) from constants.
   - Map connection errors to thrown errors Person 4 can surface (distinct from 429 rate limit).
2. **`server/segmentation/segmentSubject.ts`** — implements `SegmentSubject`:
   - Decode base64 image from `SubjectImage`.
   - Call SAM3; receive mask at native resolution.
   - **Resize** to 48×48 (nearest-neighbor or area threshold so silhouette stays recognizable).
   - Binarize: cell ≥ 0.5 → 1 else 0 (document choice).
   - Call `nameAndStoryForSegmentation({ label })` from Person 3.
   - Return object that passes `maskResponseSchema` (run parse in tests).
3. **Refactor `server/handler.ts`**:
   - Replace `ModelGenerate = (image) => Promise<string>` Gemini JSON path with `segmentSubject` (or inject `SegmentSubject` for tests).
   - Keep CORS, size limits, `drawingResponseSchema` output shape unchanged.
   - Remove **default** dependency on `generateWithGemini`; keep `gemini.ts` file for fallback flag `USE_GEMINI=1` if hackathon needs it (optional).
4. **Tests** [`server/handler.test.ts`](../../server/handler.test.ts):
   - Stub `segmentSubject` returning a known plus-mask (reuse patterns from `server/skeleton.test.ts`).
   - Test SAM connection failure → `502` or agreed code.
   - Test invalid mask from stub → `502`.

---

## Contract with Person 1

| Item | Owner |
|------|--------|
| SAM3 URL, request body | Person 1 implements; you consume |
| 48×48 grid | You implement downsampling |
| Zod `maskResponseSchema` | Frozen unless team meeting |

If Person 1’s mask is empty after resize, return `502 generation_failed` (do not return strokes).

---

## Environment

Document in `server/segmentation/README.md` (you own):

```bash
SAM3_URL=http://127.0.0.1:8790
# optional: USE_GEMINI=1 + GEMINI_API_KEY for fallback
```

Never add `GEMINI_API_KEY` to Expo public env.

---

## Acceptance criteria

- [ ] `npm test` passes including handler tests with stubbed `segmentSubject`.
- [ ] With SAM3 running locally, `curl` to Node with a real image returns `strokes` array (manual QA with Person 4).
- [ ] Only one PR touches `handler.ts` for integration (you).
- [ ] `mask` always 48×48 integers 0/1 before `strokesFromMask`.

---

## Merge order

1. Merge **contract.ts** (+ Person 3 `copy.ts`) to `main`.
2. Merge Person 1 `services/sam3`.
3. Merge your branch (handler wired to SAM).
4. Person 4 UX/docs after.

---

## Agent instructions (copy-paste)

```
You are Person 2 on dubhacks-2026. Add server/segmentation/contract.ts and segmentSubject.ts that calls SAM3 at SAM3_URL, downsamples mask to MASK_SIZE 48, merges name/story from server/segmentation/copy.ts, and wire server/handler.ts to use segmentSubject instead of generateWithGemini. Keep API response shape for the Expo client unchanged. Update server/handler.test.ts with stubs. Do not edit services/sam3/ or src/. Read docs/hackathon/sam3/person-2-node-bridge.md and AGENTS.md.
```
