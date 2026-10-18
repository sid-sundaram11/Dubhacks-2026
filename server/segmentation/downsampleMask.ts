import { MASK_SIZE } from "../../src/domain/constants";

/** Area-threshold downsample: cell is 1 when at least half of its source pixels are foreground (≥127). */
export function downsampleMaskToGrid(
  width: number,
  height: number,
  rgbaOrGray: Uint8Array,
  channels: number,
): number[][] {
  const grid = Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0));
  for (let gy = 0; gy < MASK_SIZE; gy += 1) {
    const y0 = Math.floor((gy * height) / MASK_SIZE);
    const y1 = Math.floor(((gy + 1) * height) / MASK_SIZE);
    for (let gx = 0; gx < MASK_SIZE; gx += 1) {
      const x0 = Math.floor((gx * width) / MASK_SIZE);
      const x1 = Math.floor(((gx + 1) * width) / MASK_SIZE);
      let foreground = 0;
      let total = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const idx = (y * width + x) * channels;
          const value = rgbaOrGray[idx] ?? 0;
          if (value >= 127) foreground += 1;
          total += 1;
        }
      }
      if (total > 0 && foreground >= total / 2) grid[gy]![gx] = 1;
    }
  }
  return grid;
}

export function maskGridIsEmpty(mask: number[][]): boolean {
  return mask.every((row) => row.every((cell) => cell === 0));
}
