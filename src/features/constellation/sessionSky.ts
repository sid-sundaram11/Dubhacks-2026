import type { ConstellationSegment, CustomConstellation } from "../../domain/constellation";

export interface SessionSky {
  segments: ConstellationSegment[];
  /** Segments already on the sky. The reveal animation starts after these. */
  settledCount: number;
}

/** Earlier session figures stay drawn. The active figure is last so its reveal can animate alone. */
export function sessionSky(
  session: readonly CustomConstellation[],
  active: CustomConstellation | null,
): SessionSky {
  const others = session.filter((item) => item.id !== active?.id);
  const figures = active ? [...others, active] : session;
  const segments = figures.flatMap((item) => item.segments);
  const settledCount = active
    ? others.reduce((count, item) => count + item.segments.length, 0)
    : segments.length;
  return { segments, settledCount };
}
