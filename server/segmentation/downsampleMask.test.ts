import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../../src/domain/constants";
import { downsampleMaskToGrid } from "./downsampleMask";

describe("downsampleMaskToGrid", () => {
  it("maps a centered square to a 48x48 grid", () => {
    const width = 96;
    const height = 96;
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (width * y + x) << 2;
        const inside = x >= 24 && x < 72 && y >= 24 && y < 72;
        const value = inside ? 255 : 0;
        png.data[idx] = value;
        png.data[idx + 1] = value;
        png.data[idx + 2] = value;
        png.data[idx + 3] = 255;
      }
    }
    const grid = downsampleMaskToGrid(width, height, png.data, 4);
    expect(grid.length).toBe(MASK_SIZE);
    expect(grid[0]?.length).toBe(MASK_SIZE);
    const filled = grid.flat().filter((cell) => cell === 1).length;
    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(MASK_SIZE * MASK_SIZE);
  });
});
