import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../src/domain/constants";
import type { GeneratedStroke } from "../src/domain/constellation";
import { graphFromMask, strokesFromMask, traceFittedStrokes } from "./skeleton";

function blank(): number[][] {
  return Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0));
}

function fill(mask: number[][], x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) mask[y]![x] = 1;
  }
}

function edgeVectors(strokes: readonly GeneratedStroke[]): Array<{ x: number; y: number }> {
  const vectors: Array<{ x: number; y: number }> = [];
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1]!;
      const current = stroke.points[index]!;
      vectors.push({ x: current.x - previous.x, y: current.y - previous.y });
    }
  }
  return vectors;
}

describe("skeleton constellations", () => {
  it("thins a horizontal bar to one nearly horizontal segment", () => {
    const mask = blank();
    fill(mask, 12, 40, 83, 54);
    const graph = graphFromMask(mask);
    expect(graph?.endpoints).toBe(2);
    expect(graph?.junctions).toBe(0);
    expect(graph?.strokes).toHaveLength(1);
    const [start, end] = graph!.strokes[0]!.points;
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(Math.abs(start!.y - end!.y)).toBeLessThan(0.06);
    expect(Math.abs(start!.x - end!.x)).toBeGreaterThan(0.45);
  });

  it("turns a plus into one junction, four endpoints, and four segments", () => {
    const mask = blank();
    fill(mask, 16, 40, 78, 54);
    fill(mask, 40, 16, 54, 78);
    const graph = graphFromMask(mask);
    expect(graph?.junctions).toBe(1);
    expect(graph?.endpoints).toBe(4);
    expect(graph?.strokes).toHaveLength(4);
    expect(strokesFromMask(mask)).toHaveLength(4);
    const pointKey = (point: { x: number; y: number }) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
    const shared = graph!.strokes
      .map((stroke) => new Set(stroke.points.map(pointKey)))
      .reduce((common, keys) => new Set([...common].filter((key) => keys.has(key))));
    expect(shared.size).toBe(1);
  });

  it("splits an L into perpendicular best-fit lines", () => {
    const mask = blank();
    fill(mask, 20, 16, 32, 68);
    fill(mask, 20, 56, 80, 68);
    const graph = graphFromMask(mask);
    const vectors = edgeVectors(graph?.strokes ?? []);
    expect(vectors.length).toBeGreaterThanOrEqual(2);
    const horizontal = vectors.some((vector) => Math.abs(vector.x) > Math.abs(vector.y));
    const vertical = vectors.some((vector) => Math.abs(vector.y) > Math.abs(vector.x));
    expect(horizontal).toBe(true);
    expect(vertical).toBe(true);
    const diagonalOnly = vectors.length === 1 && Math.abs(vectors[0]!.x) > 0.2 && Math.abs(vectors[0]!.y) > 0.2;
    expect(diagonalOnly).toBe(false);
  });

  it("keeps short spurs and only the largest blob on the mask grid", () => {
    const width = 40;
    const binary = new Uint8Array(width * width);
    const mark = (x: number, y: number) => {
      binary[y * width + x] = 1;
    };
    for (let index = 4; index <= 36; index += 1) {
      mark(index, 20);
      mark(20, index);
    }
    mark(28, 21);
    mark(28, 22);
    mark(28, 23);
    const graph = traceFittedStrokes(binary, width, width);
    const tipX = 28 / (width - 1);
    const tipY = 23 / (width - 1);
    const touchesSpur = graph.strokes.some((stroke) =>
      stroke.points.some((point) => Math.hypot(point.x - tipX, point.y - tipY) < 0.04),
    );
    expect(touchesSpur).toBe(true);
    expect(graph.endpoints).toBeGreaterThanOrEqual(4);

    const mask = blank();
    fill(mask, 8, 40, 56, 54);
    fill(mask, 80, 4, 90, 16);
    const separated = graphFromMask(mask);
    expect(separated?.strokes.length).toBeGreaterThan(0);
    for (const stroke of separated?.strokes ?? []) {
      for (const point of stroke.points) {
        expect(point.x).toBeLessThan(0.7);
        expect(point.y).toBeGreaterThan(0.2);
      }
    }
  });

  it("produces no strokes from an empty mask", () => {
    expect(graphFromMask(blank())).toEqual({ endpoints: 0, junctions: 0, strokes: [] });
    expect(strokesFromMask(blank())).toBeNull();
    expect(graphFromMask([[0]])).toBeNull();
  });
});
