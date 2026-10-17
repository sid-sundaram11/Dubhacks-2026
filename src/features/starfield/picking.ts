import { PICK_RADIUS_PX } from "../../domain/constants";
import type { ProjectedStar } from "../constellation/candidateSelection";

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
