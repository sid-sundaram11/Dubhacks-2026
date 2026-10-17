import { clamp } from "../../domain/math";

export function magnitudeToBrightness(magnitude: number): number {
  return clamp((7.2 - magnitude) / (7.2 - -1.46), 0, 1);
}

export function magnitudeToSize(magnitude: number, pixelRatio: number, named: boolean): number {
  const brightness = magnitudeToBrightness(magnitude);
  const emphasis = named || magnitude <= 1.5 ? 1.28 : 1;
  return (2.4 + Math.sqrt(brightness) * 8.5) * emphasis * pixelRatio;
}

export function colorFromIndex(colorIndex: number | null): [number, number, number] {
  if (colorIndex == null || !Number.isFinite(colorIndex)) return [0.93, 0.95, 1];
  if (colorIndex < 0) return [0.62, 0.76, 1];
  if (colorIndex < 0.3) return [0.78, 0.86, 1];
  if (colorIndex < 0.6) return [1, 0.98, 0.96];
  if (colorIndex <= 1) return [1, 0.84, 0.58];
  return [1, 0.58, 0.38];
}
