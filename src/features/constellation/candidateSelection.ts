import { CANDIDATE_CELL_PX, CANDIDATE_MAX } from "../../domain/constants";
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

export function selectCandidates(stars: readonly ProjectedStar[], width: number, height: number): SnapStar[] {
  const visible = stars.filter((star) => star.inFront && star.onScreen);
  const columns = Math.max(1, Math.ceil(width / CANDIDATE_CELL_PX));
  const rows = Math.max(1, Math.ceil(height / CANDIDATE_CELL_PX));
  const cells = new Map<string, ProjectedStar>();
  for (const star of visible) {
    const column = Math.min(columns - 1, Math.max(0, Math.floor(star.x / CANDIDATE_CELL_PX)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(star.y / CANDIDATE_CELL_PX)));
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
    const crowded = chosen.some((other) => Math.hypot(other.x - star.x, other.y - star.y) < CANDIDATE_CELL_PX / 2);
    if (!crowded) {
      chosen.push(star);
      chosenIds.add(star.id);
    }
  }

  chosen.sort((a, b) => b.brightness - a.brightness || a.id - b.id);
  return chosen.slice(0, CANDIDATE_MAX).map((star) => ({
    id: star.id,
    x: clamp(star.normalizedX, 0, 1),
    y: clamp(star.normalizedY, 0, 1),
    brightness: clamp(star.brightness, 0, 1),
    magnitude: star.magnitude,
  }));
}
