import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return files(path);
    if (path.endsWith(".test.ts")) return [];
    return path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".json") ? [path] : [];
  });
}

describe("client bundle boundary", () => {
  it("does not import the Gemini SDK or read the server key from app code", () => {
    const paths = [...files(resolve("src")), resolve("App.tsx"), resolve("app.json")];
    const offenders = paths.filter((path) => {
      const text = readFileSync(path, "utf8");
      return text.includes("@google/genai") || text.includes("GEMINI_API_KEY") || text.includes("EXPO_PUBLIC_GEMINI");
    });
    expect(offenders).toEqual([]);
  });
});
