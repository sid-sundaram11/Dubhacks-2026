import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../src/domain/constants";
import { buildServerGenerationDebug } from "./buildGenerationDebug";
import { dispatchRequest } from "./dispatch";
import { buildPipelineStagePngs } from "./debugStages";
import { handleGenerateConstellation } from "./handler";
import { SegmentSubjectError } from "./segmentation/segmentSubject";
import { strokesFromMask } from "./skeleton";

function blank(): number[][] {
  return Array.from({ length: MASK_SIZE }, () => Array.from({ length: MASK_SIZE }, () => 0));
}

function fill(mask: number[][], x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) mask[y]![x] = 1;
  }
}

function plusMask(): number[][] {
  const mask = blank();
  fill(mask, 16, 40, 78, 54);
  fill(mask, 40, 16, 54, 78);
  return mask;
}

const image = { mimeType: "image/jpeg" as const, data: Buffer.from("constellation-photo").toString("base64") };
const STAGE_PLACEHOLDER = "aGVsbG9Xb3JsZDEyMzQ=";
const SAM3_META = { maskWidth: 128, maskHeight: 96, label: "object", confidence: 0.91 };

function request(body: unknown) {
  return new Request("http://127.0.0.1:8787/api/generate-constellation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api routing", () => {
  it("forwards constellation generation unchanged and leaves orbit routes separate", async () => {
    const mask = plusMask();
    const segment = async () => {
      const stages = buildPipelineStagePngs(mask, STAGE_PLACEHOLDER, STAGE_PLACEHOLDER)!;
      return { name: "Night Heron", story: "A heron stands against the sky.", mask, foundPng: stages.found, maskPng: stages.mask, sam3: SAM3_META };
    };
    const direct = await handleGenerateConstellation(request({ image }), segment);
    let orbitCalled = false;
    const routed = await dispatchRequest(request({ image }), {
      orbit: {
        handle: async () => {
          orbitCalled = true;
          return new Response("orbit", { status: 500 });
        },
      },
      generate: (incoming) => handleGenerateConstellation(incoming, segment),
    });
    expect(orbitCalled).toBe(false);
    expect(routed.status).toBe(direct.status);
    const strokes = strokesFromMask(mask)!;
    const routedBody = await routed.json();
    const directBody = await direct.json();
    expect(routedBody).toEqual({
      name: "Night Heron",
      story: "A heron stands against the sky.",
      strokes,
      stages: buildPipelineStagePngs(mask, STAGE_PLACEHOLDER, STAGE_PLACEHOLDER),
      debug: buildServerGenerationDebug(mask, SAM3_META, undefined, strokes, "Night Heron", "A heron stands against the sky."),
    });
    expect(routedBody).toEqual(directBody);

    const unavailable = await dispatchRequest(request({ image }), {
      orbit: { handle: async () => new Response(null, { status: 500 }) },
      generate: (incoming) =>
        handleGenerateConstellation(incoming, async () => {
          throw new SegmentSubjectError("down", "unavailable");
        }),
    });
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: "segmentation_unavailable" });

    let generateCalled = false;
    const orbit = await dispatchRequest(new Request("http://127.0.0.1:8787/api/v1/orbits/current"), {
      orbit: { handle: async () => Response.json({ error: "unauthorized" }, { status: 401 }) },
      generate: async () => {
        generateCalled = true;
        return new Response(null, { status: 500 });
      },
    });
    expect(generateCalled).toBe(false);
    expect(orbit.status).toBe(401);

    const health = await dispatchRequest(new Request("http://127.0.0.1:8787/health"), {
      orbit: { handle: async () => new Response(null, { status: 500 }) },
    });
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true });
  });
});
