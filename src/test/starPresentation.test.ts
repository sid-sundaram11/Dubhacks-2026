import { describe, expect, it } from "vitest";
import { magnitudeToSize } from "../features/starfield/starAppearance";
import { placeStarLabels, type LabelStar } from "../features/starfield/starLabels";

const star = (id: number, x: number, y: number, magnitude = 1): LabelStar => ({ id, name: `Star ${id}`, x, y, magnitude, onScreen: true });

describe("star presentation", () => {
  it("keeps faint stars small and bright stars under four logical pixels at every density", () => {
    for (const density of [1, 2, 3]) {
      expect(magnitudeToSize(7, density)).toBeLessThan(1.2 * density);
      expect(magnitudeToSize(-1.46, density)).toBe(4 * density);
      expect(magnitudeToSize(2, density)).toBeGreaterThan(magnitudeToSize(5, density));
      expect(magnitudeToSize(2, density, true)).toBe(magnitudeToSize(2, density, false));
    }
  });

  it("prioritizes brighter labels and prevents colliding text", () => {
    const labels = placeStarLabels([star(1, 70, 100, 2), star(2, 75, 102, 0), star(3, 70, 200)], 400, 400);
    expect(labels.map((label) => label.id)).toEqual([2, 3]);
  });

  it("keeps labels out of the navigation rail, footer, and offscreen region", () => {
    const labels = placeStarLabels([star(1, 300, 60), star(2, 60, 390), { ...star(3, 70, 150), onScreen: false }, star(4, 70, 210)], 400, 400);
    expect(labels.map((label) => label.id)).toEqual([4]);
  });

  it("preserves label separation for larger system text", () => {
    const labels = placeStarLabels([star(1, 70, 100), star(2, 130, 100), star(3, 70, 200)], 400, 400, 1.5);
    expect(labels.map((label) => label.id)).toEqual([1, 3]);
    expect(labels[0]!.height).toBe(30);
  });
});
