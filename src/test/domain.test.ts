import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "../shell/appReducer";
import { FOV_MAX, FOV_MIN, MASK_SIZE, ORION_FALLBACK_IDS } from "../domain/constants";
import { celestialToCartesian } from "../features/catalog/celestialCoordinates";
import { displayName } from "../features/catalog/displayName";
import { reduceCatalog } from "../features/catalog/reduceCatalog";
import { revealedSegments } from "../features/constellation/animation";
import { frameCoordinate, minZoomFraction, selectCandidates, selectMinZoomCandidates, type ProjectedStar } from "../features/constellation/candidateSelection";
import { createConstellation } from "../features/constellation/createConstellation";
import { snapStrokesToStars, type SnapStar } from "../features/constellation/snapStrokesToStars";
import { drawingApiResponseSchema, drawingRequestSchema, drawingResponseSchema } from "../features/generation/generationSchemas";
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
  it("keeps one bright star per cell without capping the list", () => {
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
    expect(chosen.length).toBeGreaterThan(20);
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

  it("picks a different star along a stroke when the nearest match would repeat", () => {
    const snapped = snapStrokesToStars(
      [{ points: [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, { x: 0.9, y: 0.5 }] }],
      [
        { id: 1, x: 0.5, y: 0.5, brightness: 1, magnitude: 1 },
        { id: 2, x: 0.51, y: 0.5, brightness: 0.9, magnitude: 2 },
        { id: 3, x: 0.9, y: 0.5, brightness: 1, magnitude: 1 },
      ],
    );
    expect(snapped).toEqual([
      { fromStarId: 1, toStarId: 2 },
      { fromStarId: 2, toStarId: 3 },
    ]);
  });

  it("keeps every arm attached to one shared joint", () => {
    const joint = { x: 0.5, y: 0.5 };
    const snapped = snapStrokesToStars(
      [
        { points: [joint, { x: 0.5, y: 0.2 }] },
        { points: [joint, { x: 0.5, y: 0.8 }] },
        { points: [joint, { x: 0.2, y: 0.5 }] },
        { points: [joint, { x: 0.8, y: 0.5 }] },
      ],
      [
        { id: 1, x: 0.5, y: 0.5, brightness: 1, magnitude: 1 },
        { id: 2, x: 0.5, y: 0.2, brightness: 1, magnitude: 2 },
        { id: 3, x: 0.5, y: 0.8, brightness: 1, magnitude: 2 },
        { id: 4, x: 0.2, y: 0.5, brightness: 1, magnitude: 2 },
        { id: 5, x: 0.8, y: 0.5, brightness: 1, magnitude: 2 },
      ],
    );
    expect(snapped).toEqual([
      { fromStarId: 1, toStarId: 2 },
      { fromStarId: 1, toStarId: 3 },
      { fromStarId: 1, toStarId: 4 },
      { fromStarId: 1, toStarId: 5 },
    ]);
  });
});

const TEST_STAGE_PNG = "aGVsbG9Xb3JsZDEyMzQ=";
const testStageImages = () => ({
  found: TEST_STAGE_PNG,
  mask: TEST_STAGE_PNG,
  grid: TEST_STAGE_PNG,
  skeleton: TEST_STAGE_PNG,
  nodes: TEST_STAGE_PNG,
});

const testServerDebug = () => ({
  sam3: { maskWidth: 64, maskHeight: 48, label: "dog", confidence: 0.9 },
  maskGrid: Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0)),
  skeleton: {
    endpoints: 2,
    junctions: 1,
    fittedStrokeCount: 3,
    outputStrokeCount: 2,
    outputEdgeCount: 4,
  },
  name: "Test",
  story: "A test runs through the stars.",
  strokes: [
    { points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] },
    { points: [{ x: 0.2, y: 0.8 }, { x: 0.8, y: 0.2 }] },
  ],
});

describe("generation contract", () => {
  it("rejects a missing photo and accepts a one-sentence drawing", () => {
    const image = { mimeType: "image/jpeg" as const, data: Buffer.from("constellation-photo").toString("base64") };
    expect(drawingRequestSchema.safeParse({}).success).toBe(false);
    expect(drawingRequestSchema.safeParse({ image, model: "other" }).success).toBe(false);
    expect(drawingRequestSchema.safeParse({ image }).success).toBe(true);
    expect(drawingRequestSchema.safeParse({ image, prompt: "heron" }).success).toBe(true);
    const fourEdges = Array.from({ length: 4 }, (_, index) => ({
      points: [
        { x: 0.2, y: 0.2 + index * 0.1 },
        { x: 0.8, y: 0.3 + index * 0.1 },
      ],
    }));
    expect(
      drawingResponseSchema.safeParse({
        name: "Raised Dragon",
        story: "A dragon lifts its wings.",
        strokes: fourEdges,
      }).success,
    ).toBe(true);
    expect(
      drawingApiResponseSchema.safeParse({
        name: "Raised Dragon",
        story: "A dragon lifts its wings.",
        strokes: fourEdges,
        stages: testStageImages(),
        debug: testServerDebug(),
      }).success,
    ).toBe(true);
    expect(
      drawingApiResponseSchema.safeParse({
        name: "Raised Dragon",
        story: "A dragon lifts its wings.",
        strokes: fourEdges,
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
  const image = { mimeType: "image/jpeg" as const, data: Buffer.from("heart-photo").toString("base64") };
  const sky = { viewportWidth: 400, viewportHeight: 300, fov: 60 };
  const strokes = [
    {
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.35, y: 0.35 },
        { x: 0.5, y: 0.5 },
        { x: 0.65, y: 0.35 },
        { x: 0.8, y: 0.2 },
      ],
    },
  ];

  it("snaps a valid model response and reports failure instead of a stand-in shape", async () => {
    const points = strokes[0]!.points;
    const candidates: SnapStar[] = Array.from({ length: 40 }, (_, index) => {
      const point = points[index % points.length]!;
      return { id: index + 1, x: point.x, y: point.y, brightness: index < points.length ? 1 : 0.2, magnitude: index };
    });
    const created = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => ({
        name: "Bright Heart",
        story: "A heart hangs in the stars.",
        strokes,
        stages: testStageImages(),
        debug: testServerDebug(),
      }),
    });
    expect(created.kind).toBe("constellation");
    if (created.kind === "constellation") {
      expect(created.constellation.source).toBe("sam3");
      expect(created.constellation.segments.length).toBeGreaterThanOrEqual(4);
    }

    let failedCalls = 0;
    const failed = await createConstellation({
      image,
      ...sky,
      candidates: Array.from({ length: 40 }, (_, index) => ({ id: index + 1, x: 0, y: 0, brightness: 0.2, magnitude: 5 })),
      request: async () => {
        failedCalls += 1;
        throw new Error("down");
      },
    });
    expect(failed.kind).toBe("failed");
    expect(failedCalls).toBe(1);

    const unreachable = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => {
        throw new Error("fetch failed: Could not connect to the server.");
      },
    });
    expect(unreachable.kind).toBe("unreachable");

    let calls = 0;
    const segmentationDown = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => {
        calls += 1;
        throw new Error("segmentation_unavailable");
      },
    });
    expect(segmentationDown.kind).toBe("segmentation-unavailable");
    expect(calls).toBe(1);

    const noSubject = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => {
        throw new Error("no_subject");
      },
    });
    expect(noSubject.kind).toBe("no-subject");

    const outOfMemory = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => {
        throw new Error("segmentation_out_of_memory");
      },
    });
    expect(outOfMemory.kind).toBe("segmentation-out-of-memory");

    const timeout = await createConstellation({
      image,
      ...sky,
      candidates,
      request: async () => {
        throw new Error("timeout");
      },
    });
    expect(timeout.kind).toBe("timeout");

    const withPrompt = await createConstellation({
      image,
      prompt: "heron",
      ...sky,
      candidates,
      request: async (body) => {
        expect(body.prompt).toBe("heron");
        return {
          name: "Heron",
          story: "A heron waits among the fixed stars.",
          strokes,
          stages: testStageImages(),
          debug: testServerDebug(),
        };
      },
    });
    expect(withPrompt.kind).toBe("constellation");
  });

  it("asks for a wider view when fewer than 40 stars are available", async () => {
    const result = await createConstellation({
      image,
      ...sky,
      candidates: [],
      request: async () => {
        throw new Error("should not be called");
      },
    });
    expect(result.kind).toBe("zoom-out");
  });
});

describe("pipeline stage previews", () => {
  it("stores the generation probe on success and clears it when generation restarts or the drawing is cleared", () => {
    const probe = {
      stages: testStageImages(),
      server: testServerDebug(),
      client: {
        candidateCount: 40,
        fov: 60,
        viewportWidth: 400,
        viewportHeight: 300,
        segments: [{ fromStarId: 1, toStarId: 2 }],
      },
    };
    const constellation = {
      id: "c-1",
      prompt: "dog",
      name: "Sky Dog",
      story: "A dog runs through the stars.",
      segments: [],
      source: "sam3" as const,
    };
    let state = appReducer(initialAppState, { type: "generation_started" });
    expect(state.generationProbe).toBeNull();
    state = appReducer(state, {
      type: "generation_finished",
      constellation,
      at: 1_760_000_000_000,
      generationProbe: probe,
      inputPhotoUri: "file:///photo.jpg",
    });
    expect(state.generationProbe).toEqual(probe);
    expect(state.inputPhotoUri).toBe("file:///photo.jpg");
    state = appReducer(state, { type: "generation_started" });
    expect(state.generationProbe).toBeNull();
    state = appReducer(state, {
      type: "generation_finished",
      constellation,
      at: 1_760_000_100_000,
      generationProbe: probe,
      inputPhotoUri: null,
    });
    state = appReducer(state, { type: "confirm_clear" });
    expect(state.generationProbe).toBeNull();
    expect(state.inputPhotoUri).toBeNull();
    expect(state.constellation).toBeNull();
    expect(state.sessionConstellations).toHaveLength(1);
    expect(state.sessionConstellations[0]?.subjectPng).toBe(probe.stages.found);
    expect(state.sessionConstellations[0]?.addedAt).toBe(1_760_000_000_000);
    state = appReducer(state, { type: "recall_constellation", id: constellation.id });
    expect(state.constellation?.id).toBe(constellation.id);
  });

  it("keeps every generated constellation from the session", () => {
    const first = {
      id: "c-1",
      prompt: "dog",
      name: "Sky Dog",
      story: "A dog runs through the stars.",
      segments: [{ fromStarId: 1, toStarId: 2 }],
      source: "sam3" as const,
    };
    const second = { ...first, id: "c-2", name: "Sky Cat", prompt: "cat" };
    const probe = {
      stages: testStageImages(),
      server: testServerDebug(),
      client: { candidateCount: 40, fov: 60, viewportWidth: 400, viewportHeight: 300, segments: first.segments },
    };
    let state = appReducer(initialAppState, {
      type: "generation_finished",
      constellation: first,
      at: 1_760_000_000_000,
      generationProbe: probe,
      inputPhotoUri: null,
    });
    state = appReducer(state, {
      type: "generation_finished",
      constellation: second,
      at: 1_760_000_100_000,
      generationProbe: probe,
      inputPhotoUri: null,
    });
    expect(state.sessionConstellations.map((item) => item.constellation.name)).toEqual(["Sky Dog", "Sky Cat"]);
    expect(state.sessionConstellations.map((item) => item.addedAt)).toEqual([1_760_000_000_000, 1_760_000_100_000]);
    expect(state.constellation?.name).toBe("Sky Cat");
  });
});

describe("editor", () => {
  it("adds, ignores duplicates, undoes, and clears only after confirmation", () => {
    let state = appReducer(initialAppState, { type: "toggle_manual" });
    state = appReducer(state, { type: "manual_tap", id: 10, at: 100 });
    state = appReducer(state, { type: "manual_tap", id: 10, at: 200 });
    expect(state.constellation).toBeNull();
    state = appReducer(state, { type: "manual_tap", id: 11, at: 300 });
    state = appReducer(state, { type: "manual_tap", id: 10, at: 400 });
    expect(state.constellation?.segments).toHaveLength(1);
    expect(state.sessionConstellations[0]?.addedAt).toBe(300);
    state = appReducer(state, { type: "undo", at: 500 });
    expect(state.constellation?.segments).toHaveLength(0);
    expect(state.sessionConstellations[0]?.addedAt).toBe(300);
    expect(appReducer(state, { type: "request_clear" }).confirmClear).toBe(false);
    state = appReducer(state, { type: "manual_tap", id: 12, at: 600 });
    expect(state.sessionConstellations[0]?.addedAt).toBe(300);
    state = appReducer(state, { type: "request_clear" });
    expect(state.confirmClear).toBe(true);
    state = appReducer(state, { type: "confirm_clear" });
    expect(state.constellation).toBeNull();
  });
});

describe("animation", () => {
  it("shows every segment immediately when motion is reduced", () => {
    expect(revealedSegments(0, 6, true)).toBe(6);
    expect(revealedSegments(0, 6, false)).toBe(0);
  });
});

describe("min zoom frame", () => {
  function projected(id: number, nx: number, ny: number): ProjectedStar {
    return {
      id,
      x: nx * 400,
      y: ny * 400,
      normalizedX: nx,
      normalizedY: ny,
      inFront: true,
      onScreen: true,
      magnitude: 1,
      brightness: 1,
      isNamed: false,
    };
  }

  it("keeps the full view at max zoom and the centered window when zoomed out", () => {
    expect(minZoomFraction(FOV_MIN)).toBeCloseTo(1);
    expect(frameCoordinate(0.1, FOV_MIN)).toBeCloseTo(0.1);
    const fraction = minZoomFraction(FOV_MAX);
    const origin = (1 - fraction) / 2;
    expect(frameCoordinate(0.5, FOV_MAX)).toBeCloseTo(0.5);
    expect(frameCoordinate(origin, FOV_MAX)).toBeCloseTo(0);
    expect(frameCoordinate(origin + fraction, FOV_MAX)).toBeCloseTo(1);
    expect(frameCoordinate(origin - 0.02, FOV_MAX)).toBeNull();

    const stars = [
      projected(1, 0.5, 0.5),
      projected(2, origin, origin),
      projected(3, origin - 0.02, origin),
    ];
    const wide = selectMinZoomCandidates(stars, 400, 400, FOV_MAX).map((star) => star.id);
    expect(wide).toEqual(expect.arrayContaining([1, 2]));
    expect(wide).not.toContain(3);
    const close = selectMinZoomCandidates([projected(3, 0.1, 0.1)], 400, 400, FOV_MIN);
    expect(close.map((star) => star.id)).toEqual([3]);
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
