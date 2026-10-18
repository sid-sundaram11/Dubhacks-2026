# Two-phone shared room demo

Realtime rooms use **Firebase Anonymous Auth** and **Cloud Firestore** so completed constellations sync between phones without accounts or a custom WebSocket server. Photo generation still uses the Mac-hosted Node API and SAM3.

See also [sam3-dev.md](sam3-dev.md) for the segmentation stack.

## Firebase Console setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. **Build → Authentication → Sign-in method** → enable **Anonymous**.
3. **Build → Firestore Database** → create database (production mode is fine; deploy rules below).
4. **Project settings → General → Your apps** → add a **Web** app and copy the config object fields.
5. Deploy rules from this repo:
   ```bash
   npx --yes firebase-tools@15.34.0 login
   npx --yes firebase-tools@15.34.0 use --add   # select your project
   npx --yes firebase-tools@15.34.0 deploy --only firestore:rules
   ```
   Or paste `firestore.rules` into **Firestore → Rules** in the console and publish.

   A Git push does not publish Firestore rules. Deploy again after every `firestore.rules` change.

6. Verify anonymous authentication and the room transaction locally:
   ```bash
   npm run test:firebase-room
   ```

## Root `.env.local` (gitignored)

Add Firebase web config (empty placeholders in `.env.example`):

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

SAM3_URL=http://127.0.0.1:8790
```

## Physical iPhones + Mac on the same Wi‑Fi

The Node server listens on `0.0.0.0:8787`. Phones cannot use `127.0.0.1`.

1. Find the Mac LAN IP:
   ```bash
   ipconfig getifaddr en0
   ```
2. In `.env.local`:
   ```bash
   EXPO_PUBLIC_API_BASE=http://MAC_LAN_IP:8787
   ```
3. Keep the Mac, both iPhones, and the Wi‑Fi access point on the same network.
4. Start services on the Mac:
   ```bash
   # Terminal 1 — SAM3 (8790)
   cd services/sam3 && source .venv/bin/activate && python app.py
   # Terminal 2 — Node (8787)
   npm run server
   # Terminal 3 — Expo dev server
   npx expo start
   ```
5. Install on each iPhone (development build recommended for local network + Firebase):
   ```bash
   npx expo run:ios --device
   ```
   Or open the generated `ios/` project in Xcode and run on each device.
6. On first launch, allow **Local Network** when iOS prompts (needed for `EXPO_PUBLIC_API_BASE`).

## Two-phone acceptance test

1. **Phone A** — dock → **Shared room** → **Create room**. Note the six-character code.
2. **Phone B** — enter the code → **Join**. Both should show member count ≥ 2.
3. **Phone A** — pick a photo → **Generate**. **Phone B** should show a new chip under **In this room** without refreshing.
4. **Phone B** — tap the chip. The figure appears on the sky; the view jumps to the creator’s aim at generation time only.
5. **Phone B** — generate another constellation. **Phone A** sees and can open it.
6. Drag/zoom on one phone does not move the other (aim is not live-synced).

## Venue Wi‑Fi fallback (HTTPS tunnel)

Some guest networks block device-to-device LAN traffic. If phones cannot reach the Mac API:

1. Run an HTTPS tunnel to port **8787** (e.g. ngrok, Cloudflare Tunnel) on the Mac.
2. Set `EXPO_PUBLIC_API_BASE` to the tunnel’s **HTTPS** origin (no trailing slash).
3. Restart Expo so env vars reload.

Firestore sync still works over the internet; only the SAM3/Node generation path needs the tunnel.

Do not commit tunnel tokens or `.env.local`.
