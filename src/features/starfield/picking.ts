import { PICK_RADIUS_PX } from "../../domain/constants";
import type { ConstellationSegment } from "../../domain/constellation";
import type { ProjectedStar } from "../constellation/candidateSelection";

export const CONSTELLATION_HIT_PX = 22;

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-6) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function constellationBounds(
  segments: readonly ConstellationSegment[],
  stars: readonly ProjectedStar[],
  reveal: number,
  padding = 18,
): ScreenRect | null {
  const byId = new Map(stars.map((star) => [star.id, star]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const shown = Math.ceil(reveal);
  for (let index = 0; index < segments.length && index < shown; index += 1) {
    const segment = segments[index]!;
    for (const id of [segment.fromStarId, segment.toStarId]) {
      const star = byId.get(id);
      if (!star || !star.inFront || !star.onScreen) continue;
      minX = Math.min(minX, star.x);
      minY = Math.min(minY, star.y);
      maxX = Math.max(maxX, star.x);
      maxY = Math.max(maxY, star.y);
    }
  }
  if (!Number.isFinite(minX) || maxX - minX < 8 || maxY - minY < 8) return null;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function hitConstellation(
  segments: readonly ConstellationSegment[],
  stars: readonly ProjectedStar[],
  x: number,
  y: number,
  reveal: number,
  radius = CONSTELLATION_HIT_PX,
): boolean {
  const byId = new Map(stars.map((star) => [star.id, star]));
  const shown = Math.ceil(reveal);
  for (let index = 0; index < segments.length && index < shown; index += 1) {
    const segment = segments[index]!;
    const from = byId.get(segment.fromStarId);
    const to = byId.get(segment.toStarId);
    if (!from || !to || !from.inFront || !to.inFront || !from.onScreen || !to.onScreen) continue;
    if (distanceToSegment(x, y, from.x, from.y, to.x, to.y) <= radius) return true;
  }
  return false;
}

export function pickStar(stars: readonly ProjectedStar[], x: number, y: number, radius = PICK_RADIUS_PX): number | null {
  let bestId: number | null = null;
  let bestDistance = radius;
  for (const star of stars) {
    if (!star.inFront || !star.onScreen) continue;
    const distance = Math.hypot(star.x - x, star.y - y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestId = star.id;
    }
  }
  return bestId;
}
