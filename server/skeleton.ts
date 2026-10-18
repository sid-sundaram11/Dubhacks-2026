import { MASK_SIZE } from "../src/domain/constants";
import type { GeneratedStroke, StrokePoint } from "../src/domain/constellation";
import { clamp } from "../src/domain/math";

const MARGIN = 0;
const FIT_RESIDUAL = 2;

interface Point {
  x: number;
  y: number;
}

interface Branch {
  pixels: Point[];
  startId: string;
  endId: string;
  startEndpoint: boolean;
  endEndpoint: boolean;
}

export interface FittedSkeleton {
  endpoints: number;
  junctions: number;
  strokes: GeneratedStroke[];
}

function keyOf(point: Point): string {
  return `${point.x},${point.y}`;
}

function neighborsOf(binary: Uint8Array, width: number, height: number, x: number, y: number): Point[] {
  const around: Point[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (binary[ny * width + nx]) around.push({ x: nx, y: ny });
    }
  }
  return around;
}

function dilate(source: Uint8Array, width: number, height: number): Uint8Array {
  const next = new Uint8Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (source[ny * width + nx]) {
            on = 1;
            break;
          }
        }
      }
      next[y * width + x] = on;
    }
  }
  return next;
}

function erode(source: Uint8Array, width: number, height: number): Uint8Array {
  const next = new Uint8Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!source[y * width + x]) continue;
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !source[ny * width + nx]) {
            solid = false;
            break;
          }
        }
      }
      next[y * width + x] = solid ? 1 : 0;
    }
  }
  return next;
}

function largestComponent(source: Uint8Array, width: number, height: number): Uint8Array {
  const seen = new Uint8Array(source.length);
  let best: number[] = [];
  const stack: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (!source[index] || seen[index]) continue;
    const component: number[] = [];
    stack.push(index);
    seen[index] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!source[next] || seen[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (component.length > best.length) best = component;
  }
  const result = new Uint8Array(source.length);
  for (const index of best) result[index] = 1;
  return result;
}

function orderedNeighbors(binary: Uint8Array, width: number, height: number, x: number, y: number): number[] {
  const at = (nx: number, ny: number) => (nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : binary[ny * width + nx] ?? 0);
  return [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
}

function transitions(neighbors: readonly number[]): number {
  let count = 0;
  for (let index = 0; index < neighbors.length; index += 1) {
    if (neighbors[index] === 0 && neighbors[(index + 1) % neighbors.length] === 1) count += 1;
  }
  return count;
}

/** Zhang-Suen thinning to a one-pixel skeleton. */
export function skeletonize(source: Uint8Array, width: number, height: number): Uint8Array {
  const image = new Uint8Array(source);
  const doomed = new Uint8Array(image.length);
  let guard = 0;
  let changed = true;
  while (changed && guard < width * height) {
    changed = false;
    guard += 1;
    for (const pass of [0, 1]) {
      doomed.fill(0);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = y * width + x;
          if (!image[index]) continue;
          const neighbors = orderedNeighbors(image, width, height, x, y);
          const count = neighbors.reduce((sum, value) => sum + value, 0);
          if (count < 2 || count > 6 || transitions(neighbors) !== 1) continue;
          const p2 = neighbors[0] ?? 0;
          const p4 = neighbors[2] ?? 0;
          const p6 = neighbors[4] ?? 0;
          const p8 = neighbors[6] ?? 0;
          if (pass === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
          } else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          doomed[index] = 1;
        }
      }
      for (let index = 0; index < image.length; index += 1) {
        if (!doomed[index]) continue;
        image[index] = 0;
        changed = true;
      }
    }
  }
  return image;
}

function fitLine(points: readonly Point[]): { mx: number; my: number; dx: number; dy: number } | null {
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const mx = sumX / points.length;
  const my = sumY / points.length;
  let covXX = 0;
  let covYY = 0;
  let covXY = 0;
  for (const point of points) {
    const dx = point.x - mx;
    const dy = point.y - my;
    covXX += dx * dx;
    covYY += dy * dy;
    covXY += dx * dy;
  }
  if (covXX + covYY < 1e-8) return null;
  const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
  return { mx, my, dx: Math.cos(angle), dy: Math.sin(angle) };
}

function perpendicular(point: Point, line: { mx: number; my: number; dx: number; dy: number }): number {
  return Math.abs((point.x - line.mx) * line.dy - (point.y - line.my) * line.dx);
}

function fitPolyline(points: readonly Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const line = fitLine(points);
  if (!line) return [points[0]!, points[points.length - 1]!];
  let maxDistance = 0;
  let maxIndex = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicular(points[index]!, line);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }
  if (maxDistance > FIT_RESIDUAL && maxIndex > 0 && maxIndex < points.length - 1) {
    const left = fitPolyline(points.slice(0, maxIndex + 1));
    const right = fitPolyline(points.slice(maxIndex));
    return [...left.slice(0, -1), ...right];
  }
  // Keep the real node pixels so every branch that shares a joint meets at the same point.
  return [points[0]!, points[points.length - 1]!];
}

function normalizePoint(point: Point, width: number, height: number): StrokePoint {
  const sx = width <= 1 ? 0 : point.x / (width - 1);
  const sy = height <= 1 ? 0 : point.y / (height - 1);
  return {
    x: clamp(MARGIN + sx * (1 - 2 * MARGIN), 0, 1),
    y: clamp(MARGIN + sy * (1 - 2 * MARGIN), 0, 1),
  };
}

function pointsToStrokes(points: readonly Point[], width: number, height: number): GeneratedStroke[] {
  const compact: StrokePoint[] = [];
  for (const point of points) {
    const next = normalizePoint(point, width, height);
    const previous = compact[compact.length - 1];
    if (previous && Math.hypot(previous.x - next.x, previous.y - next.y) < 1e-3) continue;
    compact.push(next);
  }
  if (compact.length < 2) return [];
  return [{ points: compact }];
}

/** Trace endpoints and junctions, drop short spurs, and replace each branch with best-fit lines. */
export function traceFittedStrokes(binary: Uint8Array, width: number, height: number): FittedSkeleton {
  const adjacency = new Map<string, Point[]>();
  const degree = new Map<string, number>();
  const pixels: Point[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!binary[y * width + x]) continue;
      const pixel = { x, y };
      const around = neighborsOf(binary, width, height, x, y);
      adjacency.set(keyOf(pixel), around);
      degree.set(keyOf(pixel), around.length);
      pixels.push(pixel);
    }
  }

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current)!;
    return current;
  };
  const unite = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };
  for (const pixel of pixels) {
    if ((degree.get(keyOf(pixel)) ?? 0) >= 3) parent.set(keyOf(pixel), keyOf(pixel));
  }
  for (const pixel of pixels) {
    const id = keyOf(pixel);
    if ((degree.get(id) ?? 0) < 3) continue;
    for (const neighbor of adjacency.get(id) ?? []) {
      if ((degree.get(keyOf(neighbor)) ?? 0) >= 3) unite(id, keyOf(neighbor));
    }
  }

  const nodeId = (pixel: Point): string | null => {
    const count = degree.get(keyOf(pixel)) ?? 0;
    if (count === 1) return `e:${keyOf(pixel)}`;
    if (count >= 3) return `j:${find(keyOf(pixel))}`;
    return null;
  };

  const visited = new Set<string>();
  const seenPaths = new Set<string>();
  const branches: Branch[] = [];
  const step = (from: Point, to: Point) => `${keyOf(from)}>${keyOf(to)}`;

  for (const start of pixels) {
    const startNode = nodeId(start);
    if (startNode == null) continue;
    for (const neighbor of adjacency.get(keyOf(start)) ?? []) {
      if (nodeId(neighbor) === startNode) continue;
      if (visited.has(step(start, neighbor))) continue;
      const path: Point[] = [start];
      visited.add(step(start, neighbor));
      visited.add(step(neighbor, start));
      let previous = start;
      let current = neighbor;
      let endNode: string | null = null;
      for (let guard = 0; guard < pixels.length + 2; guard += 1) {
        path.push(current);
        const currentNode = nodeId(current);
        if (currentNode != null) {
          endNode = currentNode;
          break;
        }
        const options = (adjacency.get(keyOf(current)) ?? []).filter((item) => keyOf(item) !== keyOf(previous));
        const next = options[0];
        if (!next) break;
        visited.add(step(current, next));
        visited.add(step(next, current));
        previous = current;
        current = next;
      }
      if (endNode == null || endNode === startNode || path.length < 2) continue;
      const signature = path.map(keyOf).join("|");
      const reversed = [...path].reverse().map(keyOf).join("|");
      if (seenPaths.has(signature) || seenPaths.has(reversed)) continue;
      seenPaths.add(signature);
      branches.push({
        pixels: path,
        startId: startNode,
        endId: endNode,
        startEndpoint: startNode.startsWith("e:"),
        endEndpoint: endNode.startsWith("e:"),
      });
    }
  }

  const representative = new Map<string, Point>();
  const members = new Map<string, Point[]>();
  for (const pixel of pixels) {
    const id = nodeId(pixel);
    if (id == null) continue;
    const group = members.get(id);
    if (group) group.push(pixel);
    else members.set(id, [pixel]);
  }
  for (const [id, group] of members) {
    const cx = group.reduce((sum, pixel) => sum + pixel.x, 0) / group.length;
    const cy = group.reduce((sum, pixel) => sum + pixel.y, 0) / group.length;
    let best = group[0]!;
    let bestDistance = Infinity;
    for (const pixel of group) {
      const distance = Math.hypot(pixel.x - cx, pixel.y - cy);
      if (distance < bestDistance) {
        best = pixel;
        bestDistance = distance;
      }
    }
    representative.set(id, best);
  }

  const endpoints = new Set<string>();
  const junctions = new Set<string>();
  const strokes: GeneratedStroke[] = [];
  for (const branch of branches) {
    const start = representative.get(branch.startId) ?? branch.pixels[0]!;
    const end = representative.get(branch.endId) ?? branch.pixels[branch.pixels.length - 1]!;
    const interior = branch.pixels.slice(1, -1);
    const produced = pointsToStrokes(fitPolyline([start, ...interior, end]), width, height);
    if (produced.length === 0) continue;
    (branch.startEndpoint ? endpoints : junctions).add(branch.startId);
    (branch.endEndpoint ? endpoints : junctions).add(branch.endId);
    strokes.push(...produced);
  }
  return { endpoints: endpoints.size, junctions: junctions.size, strokes };
}

export function preparedBinaryFromMask(mask: readonly (readonly number[])[]): Uint8Array | null {
  if (mask.length !== MASK_SIZE || mask.some((row) => row.length !== MASK_SIZE)) return null;
  const filled = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) filled[y * MASK_SIZE + x] = mask[y]?.[x] ? 1 : 0;
  }
  const binary = largestComponent(erode(dilate(filled, MASK_SIZE, MASK_SIZE), MASK_SIZE, MASK_SIZE), MASK_SIZE, MASK_SIZE);
  if (!binary.some((value) => value === 1)) return null;
  return binary;
}

export function graphFromMask(mask: readonly (readonly number[])[]): FittedSkeleton | null {
  if (mask.length !== MASK_SIZE || mask.some((row) => row.length !== MASK_SIZE)) return null;
  const binary = preparedBinaryFromMask(mask);
  if (!binary) return { endpoints: 0, junctions: 0, strokes: [] };
  return traceFittedStrokes(skeletonize(binary, MASK_SIZE, MASK_SIZE), MASK_SIZE, MASK_SIZE);
}

export function strokesFromMask(mask: readonly (readonly number[])[]): GeneratedStroke[] | null {
  const graph = graphFromMask(mask);
  if (!graph || graph.strokes.length === 0) return null;
  return graph.strokes;
}
