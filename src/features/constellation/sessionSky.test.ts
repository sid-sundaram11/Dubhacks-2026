import { describe, expect, it } from "vitest";
import type { CustomConstellation } from "../../domain/constellation";
import { sessionSky } from "./sessionSky";

function figure(id: string, pairs: Array<[number, number]>): CustomConstellation {
  return {
    id,
    prompt: id,
    name: id,
    story: "A figure hangs in the sky.",
    source: "sam3",
    segments: pairs.map(([fromStarId, toStarId]) => ({ fromStarId, toStarId })),
  };
}

describe("session sky", () => {
  it("keeps every session constellation visible and animates only the active one", () => {
    const dog = figure("dog", [[1, 2], [2, 3]]);
    const cat = figure("cat", [[4, 5]]);
    const sky = sessionSky([dog, cat], cat);
    expect(sky.segments).toEqual([...dog.segments, ...cat.segments]);
    expect(sky.settledCount).toBe(2);
  });

  it("uses the latest segments when the active figure was edited", () => {
    const saved = figure("hand", [[1, 2]]);
    const edited = { ...saved, segments: [...saved.segments, { fromStarId: 2, toStarId: 3 }] };
    const sky = sessionSky([saved], edited);
    expect(sky.segments).toEqual(edited.segments);
    expect(sky.settledCount).toBe(0);
  });

  it("still draws a room figure that is not stored in the session", () => {
    const local = figure("local", [[1, 2]]);
    const remote = figure("remote", [[8, 9]]);
    const sky = sessionSky([local], remote);
    expect(sky.segments.map((segment) => segment.fromStarId)).toEqual([1, 8]);
    expect(sky.settledCount).toBe(1);
  });
});
