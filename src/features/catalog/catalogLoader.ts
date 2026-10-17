import type { CatalogStar } from "../../domain/star";
import raw from "../../../assets/data/hyg-stars.v1.json";

interface CatalogFile {
  version: string;
  stars: CatalogStar[];
}

export function loadBundledCatalog(): CatalogStar[] {
  const file = raw as CatalogFile;
  if (file.version !== "v1" || !Array.isArray(file.stars)) {
    throw new Error("Bundled star catalog is missing or has the wrong version.");
  }
  return file.stars;
}
