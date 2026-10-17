# AI Constellation Creator

Expo SDK 58 single-screen app. The product is one celestial view, not Expo Router and not a web PWA.

The sky is a dark J2000 star sphere. Do not add a camera preview, ARKit, ARCore, or a camera texture. Do not subscribe to the gyroscope in this version.

`SkyController` in `src/features/starfield/skyController.ts` is the only sky aim. Touch writes its quaternion today. A later device-attitude source may call `setAim` and must not introduce a second rotation path.

The Gemini SDK and `GEMINI_API_KEY` belong only in `server/`. Never put the key in `app.json` or an `EXPO_PUBLIC_` variable.

Constellation segments are HYG id pairs. Screen position is derived.

Do not commit `hygdata_v42.csv` or `.env.local`.
