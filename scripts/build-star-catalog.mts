import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CATALOG_MAX, CATALOG_MIN } from "../src/domain/constants";
import { parseHygCsv } from "../src/features/catalog/hygCsv";
import { chooseSeparation } from "../src/features/catalog/reduceCatalog";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const input = resolve(argument("--input"));
const output = resolve(argument("--output"));
const parsed = parseHygCsv(readFileSync(input, "utf8"));
const reduced = chooseSeparation(parsed.rows, CATALOG_MIN, CATALOG_MAX);
if (reduced.stars.length < CATALOG_MIN || reduced.stars.length > CATALOG_MAX) {
  throw new Error(`Catalog size ${reduced.stars.length} is outside ${CATALOG_MIN}-${CATALOG_MAX}`);
}

const magnitudes = reduced.stars.map((star) => star.magnitude);
const file = {
  version: "v1" as const,
  separationDegrees: Number(reduced.separationDegrees.toFixed(4)),
  sourceCount: parsed.sourceCount,
  invalidCount: parsed.invalidCount,
  validCandidateCount: reduced.validCandidateCount,
  namedAnchorCount: reduced.namedAnchorCount,
  brightestMagnitude: Math.min(...magnitudes),
  dimmestMagnitude: Math.max(...magnitudes),
  stars: reduced.stars,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(file));
const manifestPath = resolve(dirname(output), "catalog-manifest.json");
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      version: file.version,
      separationDegrees: file.separationDegrees,
      starCount: file.stars.length,
      namedAnchorCount: file.namedAnchorCount,
      brightestMagnitude: file.brightestMagnitude,
      dimmestMagnitude: file.dimmestMagnitude,
    },
    null,
    2,
  ),
);

const bytes = statSync(output).size;
console.log(
  [
    `source=${parsed.sourceCount}`,
    `invalid=${parsed.invalidCount}`,
    `candidates=${reduced.validCandidateCount}`,
    `output=${reduced.stars.length}`,
    `namedAnchors=${reduced.namedAnchorCount}`,
    `brightest=${file.brightestMagnitude}`,
    `dimmest=${file.dimmestMagnitude}`,
    `separation=${file.separationDegrees}`,
    `bytes=${bytes}`,
  ].join(" "),
);
