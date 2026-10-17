import { ANCHOR_MAG, MAG_LIMIT } from "../../domain/constants";
import type { CatalogStar } from "../../domain/star";
import { celestialToCartesian } from "./celestialCoordinates";

export interface ReduceResult {
  stars: CatalogStar[];
  validCandidateCount: number;
  namedAnchorCount: number;
  separationDegrees: number;
}

function isAnchor(star: CatalogStar): boolean {
  return star.name != null || star.magnitude <= ANCHOR_MAG;
}

function separated(
  x: number,
  y: number,
  z: number,
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array,
  count: number,
  cosThreshold: number,
): boolean {
  for (let i = 0; i < count; i += 1) {
    const dot = x * xs[i]! + y * ys[i]! + z * zs[i]!;
    if (dot > cosThreshold) return false;
  }
  return true;
}

export function reduceCatalog(rows: readonly CatalogStar[], separationDegrees: number): ReduceResult {
  const candidates = rows.filter(
    (star) => star.id !== 0 && star.magnitude <= MAG_LIMIT && Number.isFinite(star.ra) && Number.isFinite(star.dec),
  );
  const anchors = candidates.filter(isAnchor);
  const others = candidates
    .filter((star) => !isAnchor(star))
    .sort((a, b) => a.magnitude - b.magnitude || a.id - b.id);

  const capacity = candidates.length;
  const xs = new Float64Array(capacity);
  const ys = new Float64Array(capacity);
  const zs = new Float64Array(capacity);
  const kept: CatalogStar[] = [];
  const cosThreshold = Math.cos((separationDegrees * Math.PI) / 180);

  const push = (star: CatalogStar) => {
    const vector = celestialToCartesian(star.ra, star.dec);
    xs[kept.length] = vector.x;
    ys[kept.length] = vector.y;
    zs[kept.length] = vector.z;
    kept.push(star);
  };

  for (const anchor of anchors) push(anchor);
  for (const star of others) {
    const vector = celestialToCartesian(star.ra, star.dec);
    if (separated(vector.x, vector.y, vector.z, xs, ys, zs, kept.length, cosThreshold)) {
      push(star);
    }
  }

  kept.sort((a, b) => a.id - b.id);
  return {
    stars: kept,
    validCandidateCount: candidates.length,
    namedAnchorCount: anchors.length,
    separationDegrees,
  };
}

export function chooseSeparation(rows: readonly CatalogStar[], minimum: number, maximum: number): ReduceResult {
  const initial = reduceCatalog(rows, 2);
  if (initial.stars.length >= minimum && initial.stars.length <= maximum) return initial;

  let low = initial.stars.length > maximum ? 2 : 0.35;
  let high = initial.stars.length > maximum ? 8 : 2;
  let best = initial;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const mid = (low + high) / 2;
    const result = reduceCatalog(rows, mid);
    best = result;
    if (result.stars.length > maximum) low = mid;
    else if (result.stars.length < minimum) high = mid;
    else return result;
  }
  return best;
}
