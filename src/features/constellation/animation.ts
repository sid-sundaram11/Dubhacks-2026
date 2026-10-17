const DRAW_MS = 850;

export function revealedSegments(elapsedMs: number, total: number, reducedMotion: boolean): number {
  if (total <= 0) return 0;
  if (reducedMotion) return total;
  const progress = Math.min(1, Math.max(0, elapsedMs / DRAW_MS));
  return progress * total;
}
