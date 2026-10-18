import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { emptyOrbitDb, type OrbitDb } from "./types";

export function readOrbitSnapshot(path: string): OrbitDb {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as OrbitDb;
  return { ...emptyOrbitDb(), ...parsed };
}

export function writeOrbitSnapshot(path: string, db: OrbitDb): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(db));
  renameSync(temporary, path);
}
