# Constellations UI

## Entry and navigation

The launch screen contains the Constellations title, an optional room code with an inline join arrow, Solo, and an AR switch. Solo works without Firebase. Joining only enters the sky after connection succeeds; failures stay on the launch screen. Saved rooms do not bypass this screen.

The sky fills the display and stays mounted while menus open. A 50-point textured, rotating Earth inside a 64-point bottom-center button opens the native menu. Reduced Motion stops globe rotation. All image generation, drawing, undo, clear, sharing, room management, history, zoom, and recenter controls live in this menu. Star names default off. Generation traces and thumbnails require opening Generation details.

## Sky treatment

[Stellarium's official gallery](https://stellarium.org/screenshots.html) informed the dark blue sky, restrained galactic haze, varied star sizes, and soft bright-star halos. The implementation uses its own procedural galactic dust aligned with the J2000 galactic plane. It is a visual approximation, not a survey image or full Stellarium rendering engine.

HYG right ascension, declination, magnitude, and B−V colors drive stars. Point sprites range from 1 to 9 logical pixels including the halo; the bright core occupies a smaller area. Constellation segments still connect HYG IDs and project through the same sky aim. Subject cutouts remain opt-in by tapping a generated constellation.

The supplied DJORE screenshot is a typography reference, not a usable font asset. iOS uses the built-in high-contrast Didot fallback; Android uses native serif. An exact DJORE implementation requires a licensed OTF/TTF asset.

## Motion mode

AR uses `expo-sensors` DeviceMotion. It follows device rotation, with no camera feed. `deviceAttitude.ts` handles platform angle conventions and screen orientation, anchors the initial sample to the existing view, and sends subsequent aim quaternions through `SkyController.setAim`.

Switching modes preserves the current sky and field of view. Motion pauses during generation, while the menu is open, and when the app backgrounds; it reanchors on resume. Missing sensors, denied permissions, or absent initial readings return to touch mode with an explanation in the menu.

This is relative motion control. Geographic north, location/time alignment, and compass calibration are not implemented.

## Native setup and verification

`expo-sensors` and `@expo/ui` must be included in a rebuilt development client. The Expo config includes the iOS motion permission description. Native iOS pods were installed locally.

Checks: TypeScript, 61 Vitest tests (including motion anchoring, orientation, angle continuity, zoom preservation, and reanchoring), and production iOS JavaScript export passed. The iOS Release build also passed and was exercised in the iPhone 17 Pro simulator: clean launch, Solo, globe menu, drawing a star segment, undo, and unavailable-motion fallback. Physical sensor tracking and multi-device room synchronization remain unverified. The Debug build encountered a React Native Sealable linker error; Release was used for native validation.
