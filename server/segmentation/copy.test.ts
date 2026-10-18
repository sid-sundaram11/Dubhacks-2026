import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../../src/domain/constants";
import { maskResponseSchema } from "../../src/features/generation/generationSchemas";
import { nameAndStoryForSegmentation } from "./copy";

function assertCopyValid(name: string, story: string): void {
  const mask = Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0));
  expect(maskResponseSchema.safeParse({ name, story, mask }).success).toBe(true);
}

describe("nameAndStoryForSegmentation", () => {
  it("returns valid default copy", () => {
    const { name, story } = nameAndStoryForSegmentation();
    assertCopyValid(name, story);
    expect(name).toBe("Starlit Subject");
    expect(story.endsWith(".")).toBe(true);
    expect(story.match(/[.!?]/g)?.length).toBe(1);
  });

  it("title-cases a short label", () => {
    const { name, story } = nameAndStoryForSegmentation({ label: "heron" });
    assertCopyValid(name, story);
    expect(name).toBe("Heron");
    expect(story).toContain("heron");
  });

  it("truncates a long label for the name", () => {
    const long = "supercalifragilisticexpialidocious wandering bird of the northern marshes";
    const { name } = nameAndStoryForSegmentation({ label: long });
    expect(name.length).toBeGreaterThanOrEqual(1);
    expect(name.length).toBeLessThanOrEqual(48);
    assertCopyValid(name, nameAndStoryForSegmentation({ label: long }).story);
  });

  it("maps person to a prettier name", () => {
    const { name } = nameAndStoryForSegmentation({ label: "person" });
    expect(name).toBe("Silent Wanderer");
  });
});
