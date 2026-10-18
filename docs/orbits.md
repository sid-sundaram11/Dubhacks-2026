# Orbits

Weekly memory game on the existing Node API. Photo generation is unchanged: `POST /api/generate-constellation` still runs SAM3, the skeleton, and the same response. The Expo client still snaps strokes to HYG stars and still aims the sky through `SkyController`.

Orbits add a private group, one shared theme, three hidden threads, nine assignments, a cached weekly comet, a realtime solve board, and an immutable Memory Sky chapter. This branch does not add Orbit screens. Clients call the HTTP API below.

## Local setup

```bash
npm install
npm test
npm run typecheck
npm run orbit:seed
npm run server
```

With Supabase URL fields empty, the server uses a JSON snapshot (`data/orbit-store.json`, gitignored) and signs anonymous dev tokens with `ORBIT_DEV_JWT_SECRET`. Copy new keys from `.env.example` into `.env.local`. Do not commit `.env`, `.env.local`, or the service-role key. The Expo app never receives `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, or `XAI_API_KEY`.

Apply `supabase/migrations/20261018120000_orbits.sql` only when a Supabase project exists. That file enables anonymous-auth-shaped RLS, a private `orbit-private` bucket, and Realtime on solve placements, cycles, and submissions. Deploying a live project is out of scope here. When `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set, `POST /api/v1/auth/anonymous` forwards to GoTrue anonymous signup and the API accepts HS256 access tokens signed with `SUPABASE_JWT_SECRET`.

## Demo commands

`npm run orbit:seed` writes four users, one Orbit (`North Window`), invite `STAR42`, one live shared theme, three hidden threads, nine memories, a solve board, and one archived chapter with null descriptions. It prints bearer tokens for the local secret.

```bash
npm run orbit:advance   # gathering → comet → solving → archived, one step
```

`orbit:advance` stores the weekly comet before it enters the comet phase. A missing `XAI_API_KEY`, or a failed Grok Imagine response, stores the fallback PNG and haptic timeline instead. The package is cached by ISO week for every Orbit.

Accelerated phases replace production cron and push notifications:

| Phase | What members can do |
| --- | --- |
| `gathering` | Finalize the assigned constellation |
| `comet` | Reveal the shared comet |
| `solving` | Place memories and check a ring |
| `archived` | Read the sealed chapter |

## API

Authenticated calls send `Authorization: Bearer <accessToken>` from `POST /api/v1/auth/anonymous`.

| Method | Path |
| --- | --- |
| `POST` | `/api/v1/auth/anonymous` |
| `POST` | `/api/v1/orbits` |
| `POST` | `/api/v1/orbits/invite` |
| `POST` | `/api/v1/orbits/join` |
| `GET` | `/api/v1/orbits/current` |
| `GET` | `/api/v1/cycles/current` |
| `POST` | `/api/v1/comet/reveal` |
| `POST` | `/api/v1/submissions/finalize` |
| `POST` | `/api/v1/solve/place` |
| `POST` | `/api/v1/solve/check-ring` |
| `POST` | `/api/v1/demo/advance-phase` |

`POST /api/v1/submissions/finalize` stores HYG `{fromStarId,toStarId}` pairs, catalog version `v1`, the generated name and story, an optional caption, an optional description, a private image path, and optional aim and FOV. Name and story stay required. Repeating finalize for the same assignment returns the original row.

Ring checks return `{correct, archived}` only. Thread answer keys are not in cycle, board, comet, or archive payloads. A correct set of three rings seals the chapter. Descriptions may be null, and the sealed copy does not follow later edits.

## Physical phones

The API listens on `0.0.0.0:8787`. A phone cannot use `127.0.0.1`.

1. Find the Mac LAN address: `ipconfig getifaddr en0`
2. In `.env.local`, set `EXPO_PUBLIC_API_BASE=http://MAC_LAN_IP:8787`
3. Keep the Mac and both phones on the same Wi-Fi.
4. Start SAM3 on 8790, `npm run server`, and `npx expo start`.
5. Install a development build on each phone and allow Local Network.

Generation and Orbit calls share that base URL. Two authenticated devices load the same stored segments from `GET /api/v1/cycles/current`, including after the API process restarts and reloads `data/orbit-store.json`. Placements show up on the shared board for both members. Venue networks that block LAN traffic can use the same HTTPS tunnel documented in [realtime-demo.md](realtime-demo.md).

Firebase rooms remain a separate sync path. They are not the Orbit solve board.
