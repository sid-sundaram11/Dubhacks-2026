# Constellations

An Expo app that turns a text prompt into a constellation drawn between real HYG stars. The sky is a fixed J2000 sphere. Drag looks around, pinch changes field of view, and tap selects a star. Device attitude can later write the same sky quaternion; this version is finger control only.

## Run

```bash
npm install
npm run catalog -- --input /Users/angadsrivastava/Downloads/hygdata_v42.csv --output assets/data/hyg-stars.v1.json
npm test
npm run typecheck
npm run server
npx expo start
```

Photo generation uses **SAM3** for segmentation. Run the Python service on port **8790** and the Node API on **8787**; see [docs/sam3-dev.md](docs/sam3-dev.md). Set `SAM3_URL` in gitignored `.env.local`. The Expo app calls `http://127.0.0.1:8787` by default.

SAM3 hackathon notes: [docs/hackathon/sam3/](docs/hackathon/sam3/).

## Sky aim

`SkyController` owns one quaternion and field of view. Touch calls `applyDrag` and `applyPinch`. A future orientation source can call `setAim` with the same quaternion. Stars and constellation lines are reprojected from stable HYG ids whenever that aim changes.

## Interface

The black sky, compact star points, and separated controls follow the design notes in [docs/ui-design.md](docs/ui-design.md). The iOS interface uses the system Times New Roman font; Android uses its native serif fallback.
