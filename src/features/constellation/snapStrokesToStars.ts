import { MIN_SEGMENTS, SNAP_RADII } from "../../domain/constants";
import type { ConstellationSegment, GeneratedStroke } from "../../domain/constellation";
import { normalizeSegments } from "./segmentValidation";

export interface SnapStar {
  id: number;
  x: number;
  y: number;
  brightness: number;
  magnitude: number;
}

interface ScoredStar {
  star: SnapStar;
  score: number;
}

function rank(point: { x: number; y: number }, stars: readonly SnapStar[], radius: number, used: Map<number, number>): ScoredStar[] {
  const ranked: ScoredStar[] = [];
  for (const star of stars) {
    const distance = Math.hypot(star.x - point.x, star.y - point.y);
    if (distance > radius) continue;
    const dimPenalty = (1 - star.brightness) * 0.015;
    const reusePenalty = (used.get(star.id) ?? 0) * 0.02;
    ranked.push({ star, score: distance + dimPenalty + reusePenalty });
  }
  ranked.sort((a, b) => a.score - b.score || a.star.magnitude - b.star.magnitude || a.star.id - b.star.id);
  return ranked;
}

function snapAtRadius(strokes: readonly GeneratedStroke[], stars: readonly SnapStar[], radius: number): ConstellationSegment[] | null {
  const used = new Map<number, number>();
  const segments: ConstellationSegment[] = [];
  for (const stroke of strokes) {
    const matched: number[] = [];
    let previous: number | null = null;
    let failed = false;
    for (const point of stroke.points) {
      const choice = rank(point, stars, radius, used).find((candidate) => candidate.star.id !== previous);
      if (!choice) {
        failed = true;
        break;
      }
      matched.push(choice.star.id);
      previous = choice.star.id;
    }
    if (failed || matched.length < 2) continue;
    for (let i = 1; i < matched.length; i += 1) {
      segments.push({ fromStarId: matched[i - 1]!, toStarId: matched[i]! });
    }
    for (const id of matched) used.set(id, (used.get(id) ?? 0) + 1);
  }
  const normalized = normalizeSegments(segments);
  return normalized.length >= MIN_SEGMENTS ? normalized : null;
}

export function snapStrokesToStars(
  strokes: readonly GeneratedStroke[],
  stars: readonly SnapStar[],
): ConstellationSegment[] | null {
  for (const radius of SNAP_RADII) {
    const snapped = snapAtRadius(strokes, stars, radius);
    if (snapped) return snapped;
  }
  return null;
}
