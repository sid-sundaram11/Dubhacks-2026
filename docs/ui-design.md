# Constellations UI

## Reference analysis

The reference is the original Google Sky Map lineage, now maintained as Sky Map (Stardroid v1), rather than the separate Google Sky website.

- [SkyRenderer](https://github.com/sky-map-team/stardroid/blob/master/stardroid-v1/app/src/main/java/com/google/android/stardroid/renderer/SkyRenderer.java) clears to RGB (0, 0, 0). Its optional sky gradient is a separate layer, disabled at initialization. The app uses pure black, #000000.
- [PointObjectManager](https://github.com/sky-map-team/stardroid/blob/master/stardroid-v1/app/src/main/java/com/google/android/stardroid/renderer/PointObjectManager.java) renders textured star points at celestial positions, with explicit size/color and field-of-view sizing. This suggests a restrained point hierarchy instead of large decorative glows.
- SkyRenderer resolves label collisions each frame and limits rendering to active sky regions. Constellations similarly gives priority to bright named stars and avoids overlapping labels, the control rail, and the gesture hint.

These are independently implemented visual principles. No reference code, star textures, or branding assets were copied.

## Implementation

- Shared Times New Roman typography on iOS, platform serif fallback on Android; no downloadable font dependency. Colors and font selection live in src/theme.ts.
- A compact title, separate sky viewport, and fixed-height creation dock. The dock scrolls on small screens, for large text, and when results or star details expand. Adding a result never resizes the sky and displaces the generated drawing.
- The prompt and submit button share one row; suggestions and editing controls have at least 44-point targets. Sky navigation changes to a horizontal row when the viewport is short.
- Keyboard avoidance keeps the entry field accessible. Generation waits for keyboard dismissal before capturing star positions. Details and result changes reset the dock to the top.
- Stars range from approximately 1.15 to 4 logical pixels according to magnitude, with density-aware anti-aliased edges. Naming a star does not inflate it. Catalog B−V colors and J2000 coordinates are retained.
- Constellation segments are one-point muted blue lines drawn behind the stars. Selection uses a fine ring. Up to eight bright named-star labels are placed with collision checks.
- After SAM3 generation, the dock can show a **Generation trace** panel (JSON summary) and a fixed **bottom stage bar** with four pipeline thumbnails (found subject, mask, skeleton, nodes). Dock bottom padding accounts for the stage bar when a probe is present.
- **This session** is a horizontal chip row under the constellation card; it recalls prior generated figures without clearing the sky catalog view.
- Tapping a visible generated constellation line (hit test on segments, not star pick) toggles a **subject cutout** `Image` over the figure’s screen bounds at ~38% opacity (`SkyView` + `picking.constellationBounds`).
- Existing generation, manual editing, undo, confirmation, and sharing remain available. Sharing failures leave a visible retry message.

Agent-oriented UI notes live in [agent-context.md](agent-context.md).

## Validation

TypeScript checking and all 22 Vitest tests pass, including star size, label collision, reserved-control-space, and large-text label checks. The Expo tsconfig extension includes its .json suffix for compatibility with the Vitest transformer.

The iPhone 17 Pro / iOS 26.5 Expo Go preview was exercised for initial rendering, text entry, software-keyboard placement, generation from the keyboard, offline fallback, star selection/details, and clearing a drawing. Online model generation and Android rendering were not exercised in this UI pass.
