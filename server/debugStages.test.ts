import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../src/domain/constants";
import { buildPipelineStagePngs } from "./debugStages";

function blank(): number[][] {
  return Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0));
}

function fill(mask: number[][], x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) mask[y]![x] = 1;
  }
}

function plusMask(): number[][] {
  const mask = blank();
  fill(mask, 16, 40, 78, 54);
  fill(mask, 40, 16, 54, 78);
  return mask;
}

const PLACEHOLDER = "aGVsbG9Xb3JsZDEyMzQ=";

describe("buildPipelineStagePngs", () => {
  it("returns four non-empty PNGs and skeleton differs from the raw mask frame", () => {
    const mask = plusMask();
    const stages = buildPipelineStagePngs(mask, PLACEHOLDER, PLACEHOLDER);
    expect(stages).not.toBeNull();
    expect(stages!.found).toBe(PLACEHOLDER);
    expect(stages!.mask).toBe(PLACEHOLDER);
    expect(stages!.grid.length).toBeGreaterThan(100);
    expect(stages!.skeleton.length).toBeGreaterThan(100);
    expect(stages!.nodes.length).toBeGreaterThan(100);
    expect(stages!.skeleton).not.toBe(stages!.nodes);
  });
});
