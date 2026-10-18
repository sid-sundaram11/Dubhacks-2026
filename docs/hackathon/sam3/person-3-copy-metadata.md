# Person 3 — Constellation name & story (post-Gemini)

**Branch:** `feat/segmentation-copy`  
**You own:** `server/segmentation/copy.ts`, `server/segmentation/copy.test.ts`  
**Do not edit:** `server/handler.ts`, `server/gemini.ts`, `server/skeleton.ts`, `services/sam3/**`, `src/**`

---

## Agent context

Gemini currently returns **name**, **story**, and **mask** in one JSON blob ([`server/gemini.ts`](../../server/gemini.ts)). SAM3 only supplies **segmentation**; the app still needs human-readable copy for the constellation card and share export.

Validation rules live in [`maskResponseSchema`](../../src/features/generation/generationSchemas.ts) / `refineCopy`:

| Field | Rules |
|-------|--------|
| `name` | Trimmed, 1–48 characters |
| `story` | Trimmed, 1–160 characters, **exactly one** sentence ending with `.`, `!`, or `?` |

Person 2 will call your function and pass the result into the existing pipeline **before** `strokesFromMask`.

---

## Goals

1. Export a single entry point, e.g.:

```ts
export interface CopyInput {
  label?: string;      // from SAM3, e.g. "dog"
  prompt?: string;     // optional user/agent prompt
}

export function nameAndStoryForSegmentation(input?: CopyInput): {
  name: string;
  story: string;
};
```

2. **Deterministic** output (no network, no Gemini) so tests are stable.
3. **Sensible defaults** when `label` is missing:
   - Name: `"Starlit Subject"` or similar (≤ 48 chars).
   - Story: one sentence, poetic but short, must end with `.`
4. When `label` is present:
   - Name: title-case label, truncate to 48 chars without breaking mid-word if possible.
   - Story: template like `"A {label} waits among the fixed stars."` (adjust for grammar: a/an).
5. **Vitest** in `server/segmentation/copy.test.ts`:
   - Default case passes Zod refine rules.
   - Label `"heron"` → valid name/story.
   - Long label → truncated name still 1–48 chars.
   - Story never contains two sentence terminators.

Optional (time-boxed): small map of label synonyms to prettier names (`"person"` → `"Silent Wanderer"`).

---

## Integration (Person 2 does the wiring)

You only export the function. Person 2’s `segmentSubject.ts` will:

```ts
import { nameAndStoryForSegmentation } from "./copy";

const { name, story } = nameAndStoryForSegmentation({ label: samResponse.label });
```

Do **not** import SAM client or touch handler.

---

## Acceptance criteria

- [ ] `npx vitest run server/segmentation/copy.test.ts` passes.
- [ ] Every returned pair satisfies the same rules as `maskResponseSchema` superRefine (test by parsing with Zod in tests).
- [ ] No changes outside `server/segmentation/copy.ts` and `copy.test.ts` (and optionally one line in team README pointing to your module).

---

## Merge coordination

- Merge to `main` **before** Person 2’s handler integration (or same PR as `contract.ts` if lead combines).
- Zero conflict with Person 1 (Python tree) or Person 4 (Expo).

---

## Agent instructions (copy-paste)

```
You are Person 3 on dubhacks-2026. Implement server/segmentation/copy.ts with nameAndStoryForSegmentation(input?) returning name and story that always pass maskResponseSchema text rules (name 1-48 chars, story one sentence 1-160 chars ending with . ! or ?). No Gemini, no HTTP. Add server/segmentation/copy.test.ts with vitest. Do not edit handler.ts, skeleton.ts, services/sam3, or src/. See docs/hackathon/sam3/person-3-copy-metadata.md.
```
