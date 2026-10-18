# Person 4 — Expo UX, runbook, and SAM QA

**Branch:** `feat/app-sam-ux`  
**You own:** `docs/sam3-dev.md` (new), `README.md` (SAM section only), `src/features/generation/**`, `src/shell/SkyScreen.tsx`, `src/shell/appReducer.ts`, `src/components/GenerationPanel.tsx` if messaging changes  
**Do not edit:** `server/handler.ts`, `server/segmentation/**` (Persons 2–3), `services/sam3/**` (Person 1), `server/skeleton.ts` unless QA proves a mask-specific bug—then file an issue for Person 2

---

## Agent context

**dubhacks-2026** is an Expo SDK 58 app: user picks a **photo from the library** (no camera preview), taps generate, Node builds a constellation from a mask → skeleton → HYG star segments.

Current client path:

- [`pickSubjectPhoto.ts`](../../src/features/generation/pickSubjectPhoto.ts) — resize to max edge 768, JPEG base64.
- [`generationClient.ts`](../../src/features/generation/generationClient.ts) — `POST` to `EXPO_PUBLIC_API_BASE` or `http://127.0.0.1:8787`.
- [`createConstellation.ts`](../../src/features/constellation/createConstellation.ts) — results: `constellation`, `zoom-out`, `unreachable`, `rate-limited`, `failed`.
- [`appReducer.ts`](../../src/shell/appReducer.ts) — status strings for user.

After SAM3, **rate-limited** (Gemini quota) may be rare; add clearer copy for **segmentation / server / SAM down** once Person 2 exposes stable error codes (coordinate on `generation_failed` vs new code).

### AGENTS.md reminders

- Do not put SAM or Gemini keys in `app.json` or `EXPO_PUBLIC_*` secrets.
- Single sky screen; do not add Expo Router or camera UI.

---

## Goals

1. **`docs/sam3-dev.md`** — hackathon runbook:
   - Terminal 1: `npm run server` (port 8787).
   - Terminal 2: Person 1’s SAM service (port 8790).
   - Terminal 3: `npx expo start` → iOS simulator.
   - Env: `SAM3_URL` on server (document only; server reads it, not the app).
   - Troubleshooting: “Could not connect” = Node down; generic “could not be drawn” = mask/snap/SAM; how to `curl` Node health.
2. **README.md** — short “SAM3 migration” pointer to `docs/sam3-dev.md` and the four task docs in `docs/hackathon/sam3/`.
3. **Status messages** (only if needed after Person 2 merge):
   - Map `generation_failed` to user-friendly text if distinguishable (e.g. segmentation vs snap)—without parsing secrets from responses.
   - Keep existing: server not running, Gemini rate limit (legacy).
4. **QA checklist** in `docs/sam3-dev.md`:
   - Person on plain background.
   - Animal.
   - Object on cluttered background.
   - Note: constellation uses **min-zoom window** ([`selectMinZoomCandidates`](../../src/features/constellation/candidateSelection.ts)) — if snap fails, try zoom out message (already `zoom-out` kind).
5. **Optional:** dev-only log line when `__DEV__` and generation fails (error kind only, no image data).

---

## What not to change

- Request body shape `{ image }` — frozen for Person 2.
- `snapStrokesToStars.ts`, `candidateSelection.ts` — avoid unless checklist shows systematic snap failure on SAM masks; then propose diff to Person 2.

---

## Acceptance criteria

- [ ] New developer can follow `docs/sam3-dev.md` and run app + both servers.
- [ ] No `GEMINI_API_KEY` or SAM credentials in client code or `EXPO_PUBLIC_`.
- [ ] `npm run typecheck` passes.
- [ ] No edits to `server/handler.ts` or `services/sam3/`.

---

## Merge order

Merge **after** Person 2’s handler integration (or rebase on `main` once SAM path works). Conflicts unlikely if you only touch `src/` and docs.

---

## Agent instructions (copy-paste)

```
You are Person 4 on dubhacks-2026. Write docs/sam3-dev.md with three-terminal runbook (expo, npm run server, SAM3 service). Update README with SAM3 hackathon pointer. Improve Expo status messaging in appReducer/SkyScreen only if needed for server-down vs draw-failed; do not change API contracts or server code. Add manual QA checklist for photo types. Follow AGENTS.md: no secrets in the app. Do not edit server/handler.ts, server/segmentation, services/sam3, or skeleton.ts. See docs/hackathon/sam3/person-4-expo-ops.md.
```
