import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "../shell/appReducer";
import { ORION_FALLBACK_IDS } from "../domain/constants";
import { celestialToCartesian } from "../features/catalog/celestialCoordinates";
import { displayName } from "../features/catalog/displayName";
import { reduceCatalog } from "../features/catalog/reduceCatalog";
import { revealedSegments } from "../features/constellation/animation";
import { selectCandidates, type ProjectedStar } from "../features/constellation/candidateSelection";
import { createConstellation } from "../features/constellation/createConstellation";
import { fallbackForPrompt, ORION_FALLBACK_SEGMENTS } from "../features/constellation/fallbackShapes";
import { snapStrokesToStars, type SnapStar } from "../features/constellation/snapStrokesToStars";
import { drawingRequestSchema, drawingResponseSchema } from "../features/generation/generationSchemas";
import { layoutText } from "../features/share/bitmapFont";
import { projectToScreen } from "../features/starfield/projection";
import { SkyController } from "../features/starfield/skyController";
import { colorFromIndex, magnitudeToBrightness } from "../features/starfield/starAppearance";
import type { CatalogStar } from "../domain/star";

function star(partial: Partial<CatalogStar> & Pick<CatalogStar, "id" | "ra" | "dec" | "magnitude">): CatalogStar {
  return {
    hip: null,
    name: null,
    designation: null,
    colorIndex: null,
    constellation: null,
    ...partial,
  };
}

describe("celestial coordinates", () => {
  it("places the vernal equinox on +X and the north pole on +Y", () => {
    expect(celestialToCartesian(0, 0).x).toBeCloseTo(1);
    expect(celestialToCartesian(0, 0).z).toBeCloseTo(0);
    expect(celestialToCartesian(6, 0).z).toBeCloseTo(-1);
    expect(celestialToCartesian(0, 90).y).toBeCloseTo(1);
  });
});

describe("display names", () => {
  it("falls back from proper name to designation, HIP, then HYG", () => {
    expect(displayName(star({ id: 1, ra: 0, dec: 0, magnitude: 1, name: "Vega" }))).toBe("Vega");
    expect(displayName(star({ id: 2, ra: 0, dec: 0, magnitude: 1, designation: "Alp Lyr" }))).toBe("Alp Lyr");
    expect(displayName(star({ id: 3, ra: 0, dec: 0, magnitude: 1, hip: 91262 }))).toBe("HIP 91262");
    expect(displayName(star({ id: 4, ra: 0, dec: 0, magnitude: 1 }))).toBe("HYG 4");
  });
});

describe("catalog reduction", () => {
  it("drops the Sun and faint stars, keeps close named anchors, and separates dim stars", () => {
    const rows = [
      star({ id: 0, ra: 0, dec: 0, magnitude: -26 }),
      star({ id: 1, ra: 0, dec: 0, magnitude: 8 }),
      star({ id: 2, ra: 0, dec: 0, magnitude: 2, name: "Anchor" }),
      star({ id: 3, ra: 0.05, dec: 0, magnitude: 6, name: "Neighbor" }),
      star({ id: 4, ra: 0.05, dec: 0, magnitude: 5 }),
      star({ id: 5, ra: 0.05, dec: 0, magnitude: 6.5 }),
      star({ id: 6, ra: 6, dec: 0, magnitude: 4 }),
    ];
    const result = reduceCatalog(rows, 2);
    const ids = result.stars.map((item) => item.id);
    expect(ids).not.toContain(0);
    expect(ids).not.toContain(1);
    expect(ids).toEqual(expect.arrayContaining([2, 3, 6]));
    expect(ids).not.toContain(5);
    expect(ids.indexOf(2)).toBeLessThan(ids.indexOf(6));
  });
});

describe("appearance", () => {
  it("maps color-index boundaries and keeps brightness in range", () => {
    expect(colorFromIndex(-0.1)[2]).toBeGreaterThan(colorFromIndex(1.2)[2]);
    expect(colorFromIndex(0)[0]).toBeGreaterThan(0.7);
    expect(colorFromIndex(0.3)[0]).toBe(1);
    expect(colorFromIndex(0.6)[1]).toBeGreaterThan(0.8);
    expect(colorFromIndex(1)[0]).toBe(1);
    expect(colorFromIndex(1.01)[1]).toBeLessThan(0.7);
    expect(magnitudeToBrightness(-1.46)).toBe(1);
    expect(magnitudeToBrightness(7.2)).toBe(0);
  });
});

describe("projection", () => {
  it("marks stars in front of the camera and rejects stars behind it", () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const front = projectToScreen({ x: 0, y: 0, z: -1 }, camera, 200, 200);
    const behind = projectToScreen({ x: 0, y: 0, z: 1 }, camera, 200, 200);
    expect(front.inFront).toBe(true);
    expect(front.onScreen).toBe(true);
    expect(front.x).toBeCloseTo(100);
    expect(front.y).toBeCloseTo(100);
    expect(behind.inFront).toBe(false);
    expect(behind.onScreen).toBe(false);
  });
});

describe("sky aim", () => {
  it("writes one quaternion from touch and can be replaced later", () => {
    const sky = new SkyController();
    const initial = sky.getAim();
    sky.applyDrag(30, 0);
    expect(sky.getAim().quaternion).not.toEqual(initial.quaternion);
    sky.applyPinch(2);
    expect(sky.getAim().fov).toBeLessThan(initial.fov);
    sky.applyPinch(0.01);
    expect(sky.getAim().fov).toBe(85);
    sky.setAim([0, 0, 0, 1]);
    expect(sky.getAim().quaternion[3]).toBeCloseTo(1);
    sky.reset();
    expect(sky.getAim().fov).toBe(60);
  });
});

describe("candidates and snapping", () => {
  it("keeps one bright star per cell and caps the list", () => {
    const stars: ProjectedStar[] = Array.from({ length: 200 }, (_, index) => ({
      id: index + 1,
      x: (index % 10) * 10,
      y: Math.floor(index / 10) * 10,
      normalizedX: 0.5,
      normalizedY: 0.5,
      inFront: true,
      onScreen: index < 180,
      magnitude: index,
      brightness: 1 - index / 200,
      isNamed: index === 50,
    }));
    const chosen = selectCandidates(stars, 100, 200);
    expect(new Set(chosen.map((star) => star.id)).size).toBe(chosen.length);
    expect(chosen.length).toBeLessThanOrEqual(150);
    expect(chosen.every((star) => star.x >= 0 && star.x <= 1 && star.brightness >= 0 && star.brightness <= 1)).toBe(true);
  });

  it("escalates snap radius and breaks ties by magnitude then id", () => {
    const snapped = snapStrokesToStars(
      [{ points: [{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.4, y: 0 }, { x: 0.6, y: 0 }, { x: 0.8, y: 0 }] }],
      [
        { id: 2, x: 0, y: 0, brightness: 0.5, magnitude: 2 },
        { id: 1, x: 0, y: 0, brightness: 0.5, magnitude: 2 },
        { id: 3, x: 0.2, y: 0, brightness: 1, magnitude: 1 },
        { id: 4, x: 0.4, y: 0, brightness: 1, magnitude: 1 },
        { id: 5, x: 0.6, y: 0, brightness: 1, magnitude: 1 },
        { id: 6, x: 0.8, y: 0, brightness: 1, magnitude: 1 },
      ],
    );
    expect(snapped?.[0]).toEqual({ fromStarId: 1, toStarId: 3 });
    expect(snapped?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("generation contract", () => {
  it("rejects malformed prompts and accepts a one-sentence drawing", () => {
    const stars = Array.from({ length: 40 }, (_, index) => ({ id: index + 1, x: 0.2, y: 0.2, brightness: 0.5 }));
    expect(drawingRequestSchema.safeParse({ prompt: "   ", stars }).success).toBe(false);
    expect(drawingRequestSchema.safeParse({ prompt: "Dragon", stars, model: "other" }).success).toBe(false);
    const duplicate = drawingRequestSchema.safeParse({
      prompt: "Dragon",
      stars: stars.map((star) => ({ ...star, id: 1 })),
    });
    expect(duplicate.success).toBe(false);
    expect(
      drawingResponseSchema.safeParse({
        name: "Raised Dragon",
        story: "A dragon lifts its wings.",
        strokes: [{ points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }, { x: 0.4, y: 0.4 }, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }, { x: 0.7, y: 0.7 }, { x: 0.8, y: 0.5 }] }],
      }).success,
    ).toBe(true);
    expect(
      drawingResponseSchema.safeParse({
        name: "Nope",
        story: "Two sentences. Not allowed.",
        strokes: [{ points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.4 }] }],
      }).success,
    ).toBe(false);
  });
});

describe("constellation creation", () => {
  it("snaps a valid model response and falls back after two failures", async () => {
    const template = fallbackForPrompt("heart");
    const points = template.strokes[0]!.points;
    const candidates: SnapStar[] = Array.from({ length: 40 }, (_, index) => {
      const point = points[index % points.length]!;
      return { id: index + 1, x: point.x, y: point.y, brightness: index < points.length ? 1 : 0.2, magnitude: index };
    });
    const created = await createConstellation({
      prompt: "a heart",
      candidates,
      request: async () => ({ name: "Bright Heart", story: "A heart hangs in the stars.", strokes: template.strokes }),
    });
    expect(created.kind).toBe("constellation");
    if (created.kind === "constellation") {
      expect(created.constellation.source).toBe("gemini");
      expect(created.constellation.segments.length).toBeGreaterThanOrEqual(4);
      expect(created.resetSky).toBe(false);
    }

    const offline = await createConstellation({
      prompt: "a heart",
      candidates: Array.from({ length: 40 }, (_, index) => ({ id: index + 1, x: 0, y: 0, brightness: 0.2, magnitude: 5 })),
      request: async () => {
        throw new Error("down");
      },
    });
    expect(offline.kind).toBe("constellation");
    if (offline.kind === "constellation") {
      expect(offline.offline).toBe(true);
      expect(offline.resetSky).toBe(true);
      expect(offline.constellation.segments).toEqual(ORION_FALLBACK_SEGMENTS);
    }
  });

  it("asks for a wider view when fewer than 40 stars are available", async () => {
    const result = await createConstellation({
      prompt: "Dragon",
      candidates: [],
      request: async () => {
        throw new Error("should not be called");
      },
    });
    expect(result.kind).toBe("zoom-out");
  });
});

describe("editor", () => {
  it("adds, ignores duplicates, undoes, and clears only after confirmation", () => {
    let state = appReducer(initialAppState, { type: "toggle_manual" });
    state = appReducer(state, { type: "manual_tap", id: 10 });
    state = appReducer(state, { type: "manual_tap", id: 10 });
    expect(state.constellation).toBeNull();
    state = appReducer(state, { type: "manual_tap", id: 11 });
    state = appReducer(state, { type: "manual_tap", id: 10 });
    expect(state.constellation?.segments).toHaveLength(1);
    state = appReducer(state, { type: "undo" });
    expect(state.constellation?.segments).toHaveLength(0);
    expect(appReducer(state, { type: "request_clear" }).confirmClear).toBe(false);
    state = appReducer(state, { type: "manual_tap", id: 12 });
    state = appReducer(state, { type: "request_clear" });
    expect(state.confirmClear).toBe(true);
    state = appReducer(state, { type: "confirm_clear" });
    expect(state.constellation).toBeNull();
  });
});

describe("animation and fallback prompts", () => {
  it("shows every segment immediately when motion is reduced", () => {
    expect(revealedSegments(0, 6, true)).toBe(6);
    expect(revealedSegments(0, 6, false)).toBe(0);
    expect(fallbackForPrompt("a dragon with raised wings").name).toBe("Raised Dragon");
    expect(fallbackForPrompt("paper crane").name).toBe("Four-Point Star");
  });
});

describe("share caption", () => {
  it("lays out readable pixels for the export", () => {
    expect(layoutText("Dragon", 0, 0, 2, 200).length).toBeGreaterThan(10);
  });
});

describe("bundled catalog", () => {
  it("contains the rehearsed Orion stars", () => {
    const file = JSON.parse(readFileSync(resolve("assets/data/hyg-stars.v1.json"), "utf8")) as {
      stars: CatalogStar[];
    };
    const ids = new Set(file.stars.map((item) => item.id));
    expect(file.stars.length).toBeGreaterThanOrEqual(4000);
    expect(file.stars.length).toBeLessThanOrEqual(4500);
    expect(ids.size).toBe(file.stars.length);
    for (const id of Object.values(ORION_FALLBACK_IDS)) expect(ids.has(id)).toBe(true);
    const sorted = [...file.stars].sort((a, b) => a.id - b.id);
    expect(file.stars.map((item) => item.id)).toEqual(sorted.map((item) => item.id));
  });
});
