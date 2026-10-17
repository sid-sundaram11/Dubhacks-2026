# AI Constellation Creator

Expo SDK 58 single-screen app. The product is one celestial view, not Expo Router and not a web PWA.

The sky is a dark J2000 star sphere. Do not add a camera preview, ARKit, ARCore, or a camera texture. Do not subscribe to the gyroscope in this version.

`SkyController` in `src/features/starfield/skyController.ts` is the only sky aim. Touch writes its quaternion today. A later device-attitude source may call `setAim` and must not introduce a second rotation path.

The Gemini SDK and `GEMINI_API_KEY` belong only in `server/`. Never put the key in `app.json` or an `EXPO_PUBLIC_` variable.

Constellation segments are HYG id pairs. Screen position is derived.

Do not commit `hygdata_v42.csv` or `.env.local`.

## Cursor Cloud specific instructions

- Node.js 22.13 or newer is required. `bash .cursor/install.sh` installs that on Linux when it is missing, then runs `npm ci`. The committed catalog `assets/data/hyg-stars.v1.json` is enough to run and test; the HYG CSV is not.
- `npm test` and `npm run typecheck` are the checks. Vitest's Oxc loader resolves `tsconfig.json` `extends` as a file path, so the Expo base config is referenced from `node_modules`.
- `npm run server` listens on port 8787. `GEMINI_API_KEY` is optional and stays in gitignored `.env.local`. Without it, `POST /api/generate-constellation` returns 502 and Dragon, Heart, and Rocket still draw through the offline fallback.
- `npx expo start --localhost --port 8081` serves the native Metro bundle. This is one Expo screen. There is no web target and no device simulator in the cloud image. A bundle request to `http://localhost:8081/index.ts.bundle?platform=ios&dev=true` proves the app compiles. Use `localhost`, not `127.0.0.1`, because `--localhost` may bind IPv6 only.
