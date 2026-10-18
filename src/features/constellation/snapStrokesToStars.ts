import { SNAP_RADII } from "../../domain/constants";
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

function pointKey(point: { x: number; y: number }): string {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
}

function chooseStar(
  point: { x: number; y: number },
  stars: readonly SnapStar[],
  used: Map<number, number>,
  avoid: number | null,
): number | null {
  for (const radius of SNAP_RADII) {
    const candidates = rank(point, stars, radius, used).filter((candidate) => candidate.star.id !== avoid);
    const unused = candidates.find((candidate) => (used.get(candidate.star.id) ?? 0) === 0);
    if (unused) return unused.star.id;
    if (candidates[0]) return candidates[0].star.id;
  }
  const widest = SNAP_RADII[SNAP_RADII.length - 1] ?? 0;
  const fallback = rank(point, stars, widest, used).find((candidate) => candidate.star.id !== avoid);
  return fallback?.star.id ?? rank(point, stars, widest, used)[0]?.star.id ?? null;
}

export function snapStrokesToStars(
  strokes: readonly GeneratedStroke[],
  stars: readonly SnapStar[],
): ConstellationSegment[] | null {
  const jointStars = new Map<string, number>();
  const used = new Map<number, number>();

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      const key = pointKey(point);
      if (jointStars.has(key)) continue;
      const chosen = chooseStar(point, stars, used, null);
      if (chosen == null) continue;
      jointStars.set(key, chosen);
      used.set(chosen, (used.get(chosen) ?? 0) + 1);
    }
  }

  const segments: ConstellationSegment[] = [];
  for (const stroke of strokes) {
    let previous: number | null = null;
    for (const point of stroke.points) {
      const key = pointKey(point);
      let starId = jointStars.get(key);
      if (starId == null) {
        starId = chooseStar(point, stars, used, previous) ?? undefined;
        if (starId == null) continue;
      } else if (previous != null && starId === previous) {
        const alternate = chooseStar(point, stars, used, previous);
        if (alternate != null) starId = alternate;
      }
      if (previous != null && previous !== starId) {
        segments.push({ fromStarId: previous, toStarId: starId });
      }
      previous = starId;
    }
  }
  const normalized = normalizeSegments(segments);
  return normalized.length > 0 ? normalized : null;
}
