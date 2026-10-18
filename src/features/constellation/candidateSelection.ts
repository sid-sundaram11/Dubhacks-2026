import { CANDIDATE_CELL_PX, FOV_MIN } from "../../domain/constants";
import { clamp } from "../../domain/math";
import type { SnapStar } from "./snapStrokesToStars";

export interface ProjectedStar {
  id: number;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  inFront: boolean;
  onScreen: boolean;
  magnitude: number;
  brightness: number;
  isNamed: boolean;
}

/** Screen fraction of a max-zoom view, using the vertical perspective field of view. */
export function minZoomFraction(fov: number): number {
  if (!Number.isFinite(fov) || fov <= 0) return 1;
  const tanHalf = (degrees: number) => Math.tan((degrees * Math.PI) / 360);
  return clamp(tanHalf(FOV_MIN) / tanHalf(fov), 0, 1);
}

/** Map a full-screen normalized coordinate into the centered max-zoom window. */
export function frameCoordinate(value: number, fov: number): number | null {
  const fraction = minZoomFraction(fov);
  if (fraction <= 0) return null;
  const origin = (1 - fraction) / 2;
  const framed = (value - origin) / fraction;
  if (framed < -1e-6 || framed > 1 + 1e-6) return null;
  return clamp(framed, 0, 1);
}

export function selectMinZoomCandidates(
  stars: readonly ProjectedStar[],
  width: number,
  height: number,
  fov: number,
): SnapStar[] {
  const fraction = minZoomFraction(fov);
  const framed: ProjectedStar[] = [];
  for (const star of stars) {
    if (!star.inFront || !star.onScreen) continue;
    const x = frameCoordinate(star.normalizedX, fov);
    const y = frameCoordinate(star.normalizedY, fov);
    if (x == null || y == null) continue;
    framed.push({ ...star, normalizedX: x, normalizedY: y });
  }
  return selectCandidates(framed, width, height, CANDIDATE_CELL_PX * fraction);
}

export function selectCandidates(
  stars: readonly ProjectedStar[],
  width: number,
  height: number,
  cellPx = CANDIDATE_CELL_PX,
): SnapStar[] {
  const cell = Math.max(1, cellPx);
  const visible = stars.filter((star) => star.inFront && star.onScreen);
  const columns = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const cells = new Map<string, ProjectedStar>();
  for (const star of visible) {
    const column = Math.min(columns - 1, Math.max(0, Math.floor(star.x / cell)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(star.y / cell)));
    const key = `${column}:${row}`;
    const current = cells.get(key);
    if (
      !current ||
      star.brightness > current.brightness ||
      (star.brightness === current.brightness && star.id < current.id)
    ) {
      cells.set(key, star);
    }
  }

  const chosen = [...cells.values()];
  const chosenIds = new Set(chosen.map((star) => star.id));
  for (const star of visible) {
    if (!star.isNamed || chosenIds.has(star.id)) continue;
    const crowded = chosen.some((other) => Math.hypot(other.x - star.x, other.y - star.y) < cell / 2);
    if (!crowded) {
      chosen.push(star);
      chosenIds.add(star.id);
    }
  }

  chosen.sort((a, b) => b.brightness - a.brightness || a.id - b.id);
  return chosen.map((star) => ({
    id: star.id,
    x: clamp(star.normalizedX, 0, 1),
    y: clamp(star.normalizedY, 0, 1),
    brightness: clamp(star.brightness, 0, 1),
    magnitude: star.magnitude,
  }));
}
