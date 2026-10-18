import { PNG } from "pngjs";
import { MASK_SIZE } from "../src/domain/constants";
import type { GeneratedStroke } from "../src/domain/constellation";
import { graphFromMask, preparedBinaryFromMask, skeletonize } from "./skeleton";

const SCALE = 8;
const MARGIN = 0;

export interface PipelineStagePngs {
  found: string;
  mask: string;
  grid: string;
  skeleton: string;
  nodes: string;
}

function neighbors(binary: Uint8Array, width: number, height: number, x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (binary[ny * width + nx]) count += 1;
    }
  }
  return count;
}

function denormalizeStrokePoint(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const span = 1 - 2 * MARGIN;
  const sx = span <= 0 ? 0 : (x - MARGIN) / span;
  const sy = span <= 0 ? 0 : (y - MARGIN) / span;
  return {
    x: Math.max(0, Math.min(width - 1, Math.round(sx * (width - 1)))),
    y: Math.max(0, Math.min(height - 1, Math.round(sy * (height - 1)))),
  };
}

function setPixel(data: Buffer, width: number, x: number, y: number, r: number, g: number, b: number): void {
  const index = (y * width + x) * 4;
  data[index] = r;
  data[index + 1] = g;
  data[index + 2] = b;
  data[index + 3] = 255;
}

function fillDisk(data: Buffer, width: number, height: number, cx: number, cy: number, radius: number, r: number, g: number, b: number): void {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      setPixel(data, width, x, y, r, g, b);
    }
  }
}

function drawLine(
  data: Buffer,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (x >= 0 && y >= 0 && x < width && y < height) setPixel(data, width, x, y, r, g, b);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function rasterizeStrokes(data: Buffer, width: number, height: number, strokes: readonly GeneratedStroke[]): void {
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.points.length; index += 1) {
      const a = denormalizeStrokePoint(stroke.points[index - 1]!.x, stroke.points[index - 1]!.y, width, height);
      const b = denormalizeStrokePoint(stroke.points[index]!.x, stroke.points[index]!.y, width, height);
      drawLine(data, width, height, a.x, a.y, b.x, b.y, 255, 255, 255);
    }
  }
}

function scaleNearest(source: Buffer, srcW: number, srcH: number, scale: number): Buffer {
  const dstW = srcW * scale;
  const dstH = srcH * scale;
  const out = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y += 1) {
    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      out[di] = source[si]!;
      out[di + 1] = source[si + 1]!;
      out[di + 2] = source[si + 2]!;
      out[di + 3] = 255;
    }
  }
  return out;
}

function encodePng(width: number, height: number, data: Buffer): string {
  const png = new PNG({ width, height });
  data.copy(png.data);
  return PNG.sync.write(png).toString("base64");
}

function maskGridPreviewPng(mask: readonly (readonly number[])[]): string {
  const data = Buffer.alloc(MASK_SIZE * MASK_SIZE * 4);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) {
      if (!mask[y]?.[x]) continue;
      setPixel(data, MASK_SIZE, x, y, 255, 255, 255);
    }
  }
  const scaled = scaleNearest(data, MASK_SIZE, MASK_SIZE, SCALE);
  return encodePng(MASK_SIZE * SCALE, MASK_SIZE * SCALE, scaled);
}

function skeletonPreviewPng(skeleton: Uint8Array): string {
  const data = Buffer.alloc(MASK_SIZE * MASK_SIZE * 4);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) {
      if (!skeleton[y * MASK_SIZE + x]) continue;
      setPixel(data, MASK_SIZE, x, y, 255, 255, 255);
    }
  }
  const scaled = scaleNearest(data, MASK_SIZE, MASK_SIZE, SCALE);
  return encodePng(MASK_SIZE * SCALE, MASK_SIZE * SCALE, scaled);
}

function nodesPreviewPng(skeleton: Uint8Array, strokes: readonly GeneratedStroke[]): string {
  const data = Buffer.alloc(MASK_SIZE * MASK_SIZE * 4);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) {
      if (!skeleton[y * MASK_SIZE + x]) continue;
      setPixel(data, MASK_SIZE, x, y, 64, 64, 64);
    }
  }
  rasterizeStrokes(data, MASK_SIZE, MASK_SIZE, strokes);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) {
      if (!skeleton[y * MASK_SIZE + x]) continue;
      const degree = neighbors(skeleton, MASK_SIZE, MASK_SIZE, x, y);
      if (degree === 1) fillDisk(data, MASK_SIZE, MASK_SIZE, x, y, 1, 158, 203, 208);
      else if (degree >= 3) fillDisk(data, MASK_SIZE, MASK_SIZE, x, y, 1, 255, 200, 100);
    }
  }
  const scaled = scaleNearest(data, MASK_SIZE, MASK_SIZE, SCALE);
  return encodePng(MASK_SIZE * SCALE, MASK_SIZE * SCALE, scaled);
}

export function buildPipelineStagePngs(
  mask: readonly (readonly number[])[],
  foundPng: string,
  maskPng: string,
  outputStrokes?: readonly GeneratedStroke[],
): PipelineStagePngs | null {
  const binary = preparedBinaryFromMask(mask);
  if (!binary) return null;
  const skeleton = skeletonize(binary, MASK_SIZE, MASK_SIZE);
  const graph = graphFromMask(mask);
  if (!graph) return null;
  return {
    found: foundPng,
    mask: maskPng,
    grid: maskGridPreviewPng(mask),
    skeleton: skeletonPreviewPng(skeleton),
    nodes: nodesPreviewPng(skeleton, outputStrokes ?? graph.strokes),
  };
}
