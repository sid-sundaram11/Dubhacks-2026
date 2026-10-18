import { clamp } from "../../domain/math";

export function magnitudeToBrightness(magnitude: number): number {
  return clamp((7.2 - magnitude) / (7.2 - -1.46), 0, 1);
}

export function magnitudeToSize(magnitude: number, pixelRatio: number, _named = false): number {
  const brightness = magnitudeToBrightness(magnitude);
  // Apparent magnitude controls size, independent of whether a star has a name.
  return (1.0 + Math.pow(brightness, 2.4) * 8.0) * pixelRatio;
}

export function colorFromIndex(colorIndex: number | null): [number, number, number] {
  if (colorIndex == null || !Number.isFinite(colorIndex)) return [0.93, 0.95, 1];
  if (colorIndex < 0) return [0.62, 0.76, 1];
  if (colorIndex < 0.3) return [0.78, 0.86, 1];
  if (colorIndex < 0.6) return [1, 0.98, 0.96];
  if (colorIndex <= 1) return [1, 0.84, 0.58];
  return [1, 0.58, 0.38];
}
