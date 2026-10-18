import { describe, expect, it } from "vitest";
import type { ProjectedStar } from "../constellation/candidateSelection";
import { constellationBounds, hitConstellation } from "./picking";

function star(id: number, x: number, y: number): ProjectedStar {
  return {
    id,
    x,
    y,
    normalizedX: x / 100,
    normalizedY: y / 100,
    inFront: true,
    onScreen: true,
    magnitude: 2,
    brightness: 1,
    isNamed: false,
  };
}

describe("constellation picking", () => {
  const stars = [star(1, 10, 10), star(2, 80, 10), star(3, 80, 70)];
  const segments = [
    { fromStarId: 1, toStarId: 2 },
    { fromStarId: 2, toStarId: 3 },
  ];

  it("hits a drawn line and ignores empty sky", () => {
    expect(hitConstellation(segments, stars, 40, 12, 2)).toBe(true);
    expect(hitConstellation(segments, stars, 20, 60, 2)).toBe(false);
  });

  it("frames the visible stars of the drawing", () => {
    const bounds = constellationBounds(segments, stars, 2, 0);
    expect(bounds).toEqual({ x: 10, y: 10, width: 70, height: 60 });
  });
});
