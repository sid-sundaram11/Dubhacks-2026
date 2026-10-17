import type { ConstellationSegment } from "../../domain/constellation";
import { isDuplicateSegment } from "./segmentValidation";

export function appendSegment(
  segments: readonly ConstellationSegment[],
  fromStarId: number,
  toStarId: number,
): ConstellationSegment[] | null {
  if (isDuplicateSegment(segments, fromStarId, toStarId)) return null;
  return [...segments, { fromStarId, toStarId }];
}

export function undoSegment(segments: readonly ConstellationSegment[]): {
  segments: ConstellationSegment[];
  pathStarId: number | null;
} {
  if (segments.length === 0) return { segments: [], pathStarId: null };
  const removed = segments[segments.length - 1]!;
  return {
    segments: segments.slice(0, -1),
    pathStarId: removed.fromStarId,
  };
}
