import { MAX_SEGMENTS } from "../../domain/constants";
import type { ConstellationSegment } from "../../domain/constellation";

export function normalizeSegments(segments: readonly ConstellationSegment[]): ConstellationSegment[] {
  const seen = new Set<string>();
  const result: ConstellationSegment[] = [];
  for (const segment of segments) {
    if (segment.fromStarId === segment.toStarId) continue;
    const low = Math.min(segment.fromStarId, segment.toStarId);
    const high = Math.max(segment.fromStarId, segment.toStarId);
    const key = `${low}:${high}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(segment);
    if (result.length === MAX_SEGMENTS) break;
  }
  return result;
}

export function isDuplicateSegment(
  segments: readonly ConstellationSegment[],
  fromStarId: number,
  toStarId: number,
): boolean {
  if (fromStarId === toStarId) return true;
  return segments.some(
    (segment) =>
      (segment.fromStarId === fromStarId && segment.toStarId === toStarId) ||
      (segment.fromStarId === toStarId && segment.toStarId === fromStarId),
  );
}
