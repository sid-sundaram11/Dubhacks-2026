# Orbit — product description

Orbit is a single-screen Expo app that turns a photo of something you care about into a drawing made of real stars. You explore a dark, accurate night sky, pick an image from your library, and the app places straight lines between actual stars from the HYG catalog so the shape stays fixed on the sphere as you drag and zoom.

There is no camera preview, AR, or gyroscope in this version. The sky is a J2000 star sphere you navigate with touch only. A future device-attitude source could drive the same sky aim without adding a second rotation path.

## What the user does

1. **Explore the sky** — Drag to look around, pinch to change field of view, tap a star to read its name and details.
2. **Choose a photo** — Open the system photo library (not an in-app camera). A thumbnail confirms the selection.
3. **Generate** — The app sends the resized image and optional subject prompt to the local Node API (SAM3 mask → **96×96** skeleton grid → strokes). When generation succeeds, lines appear between stars and animate in. The dock keeps the constellation name in its session list and shows four pipeline stage images.
4. **Recall and reveal** — Switch among constellations created **this session** via chips in the dock. Tap the drawn figure on the sky to overlay the segmented subject (cutout from the photo) at low opacity.
5. **Edit or share** — Connect stars by hand in manual mode, undo segments, clear the drawing, or export a PNG of the sky with caption text.

If generation fails, the sky is unchanged. There is no generic “four-point star” or other placeholder shape when the pipeline cannot produce a valid constellation.

## How the shape is made

The product goal is a **constellation that follows the subject in the photo**, not a hand-wavy star clipart.

```text
Photo + subject text → SAM3 (silhouette mask) → skeleton → simplified strokes → snap to HYG stars
```

1. **SAM3 (separate service)** — Text-prompted instance segmentation returns a foreground mask. Optional **Subject in the photo** in the app is sent as the prompt. Name and story are generated deterministically on the Node server. No model keys in the client.
2. **Mask cleanup** — Keep the largest foreground blob and close small holes.
3. **Skeletonization** — Thin the silhouette to a one-pixel-wide medial axis (Zhang–Suen thinning, same idea as scikit-image’s skeleton examples).
4. **Graph simplification** — Find endpoints and junctions on the skeleton, trace branches between them, and replace each branch with piecewise straight segments (total least-squares lines). Junction pixels are unified so branches share exact endpoints. There is no fixed min/max segment count cap on the server.
5. **Snap to stars** — Each stroke point is matched to bright stars visible in the current view. Consecutive points on a stroke must not collapse onto the same star (an alternate nearby star is chosen when needed). Constellations are stored as **pairs of HYG star ids**; screen position is always derived from the catalog and the current aim.

## Fixed size on the sky

A constellation should look the same **angular size** whether you generated it zoomed in or zoomed out. Strokes are defined in normalized view coordinates, but snapping uses only stars inside a centered window that matches the **most zoomed-in** field of view (25°). That window is renormalized to fill the stroke space before snapping. Wider zoom at generation time does not stretch the figure across more of the celestial sphere.

If too few stars fall in that window, the app asks you to zoom out so more of the sky is available, then try again.

## Architecture boundaries

| Piece | Role |
|--------|------|
| **Expo client** | Star field (Three.js / expo-gl), touch aim (`SkyController`), photo picker, manual editing, share |
| **Node server** | SAM3 client, mask → skeleton → strokes, stage PNGs + debug payload, subject cutout |
| **SAM3 service** | `services/sam3`, port 8790 |
| **HYG catalog** | Bundled reduced star set; segments reference stable ids |

Manual drawing, undo, clear-with-confirmation, reduced-motion reveal, and offline catalog browsing remain supported. Automated generation is **photo-only**; text prompts and offline template shapes (dragon, heart, rocket, generic star) are not part of the final product.

## Running locally

```bash
npm install
npm run catalog -- --input /path/to/hygdata_v42.csv --output assets/data/hyg-stars.v1.json
npm test
npm run typecheck
npm run server   # SAM3_URL in .env.local; start services/sam3 on 8790
npx expo start   # talks to http://127.0.0.1:8787 by default
```

Do not commit `hygdata_v42.csv` or `.env.local`.

## Design intent

The interface follows a calm, Sky Map–inspired presentation: black sky, restrained star points, constellation lines behind the stars, and a dock for creation and tools. The experience should feel like **inventing a personal asterism on a real map**, grounded in catalog data and a clear vision pipeline from photo to skeleton to star graph—not a decorative overlay unrelated to the image.

Implementation reference for contributors and coding agents: [docs/agent-context.md](docs/agent-context.md).
