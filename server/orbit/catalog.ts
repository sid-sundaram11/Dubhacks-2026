import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HYG_CATALOG_VERSION } from "../../src/features/orbit/orbitSchemas";

interface CatalogFile {
  version: string;
  stars: { id: number }[];
}

let cache: { version: string; ids: Set<number> } | null = null;

function loadCatalog(): { version: string; ids: Set<number> } {
  if (cache) return cache;
  const file = JSON.parse(readFileSync(resolve(process.cwd(), "assets/data/hyg-stars.v1.json"), "utf8")) as CatalogFile;
  if (file.version !== HYG_CATALOG_VERSION || !Array.isArray(file.stars)) {
    throw new Error("Bundled star catalog is missing or has the wrong version.");
  }
  cache = { version: file.version, ids: new Set(file.stars.map((star) => star.id)) };
  return cache;
}

export function catalogHas(id: number): boolean {
  return loadCatalog().ids.has(id);
}

export function bundledCatalogVersion(): string {
  return loadCatalog().version;
}
