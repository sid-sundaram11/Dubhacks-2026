import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../src/domain/constants";
import { MAX_REQUEST_BYTES } from "../src/features/generation/generationSchemas";
import { buildServerGenerationDebug } from "./buildGenerationDebug";
import { buildPipelineStagePngs } from "./debugStages";
import { handleGenerateConstellation } from "./handler";
import { SegmentSubjectError } from "./segmentation/segmentSubject";
import { strokesFromMask } from "./skeleton";

function request(body: unknown, init?: { method?: string; origin?: string; contentType?: string; raw?: string }) {
  return new Request("http://127.0.0.1:8787/api/generate-constellation", {
    method: init?.method ?? "POST",
    headers: {
      "content-type": init?.contentType ?? "application/json",
      ...(init?.origin ? { origin: init.origin } : {}),
    },
    body: init?.method === "GET" ? undefined : (init?.raw ?? JSON.stringify(body)),
  });
}

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

function segmentFromMask(mask: number[][], name: string, story: string) {
  const stages = buildPipelineStagePngs(mask, STAGE_PLACEHOLDER, STAGE_PLACEHOLDER)!;
  return { name, story, mask, foundPng: stages.found, maskPng: stages.mask, sam3: SAM3_META };
}

describe("generate constellation handler", () => {
  it("turns a subject mask into skeleton strokes and hides model failures", async () => {
    const mask = plusMask();
    const response = await handleGenerateConstellation(request({ image }), async () =>
      segmentFromMask(mask, "Night Heron", "A heron stands against the sky."),
    );
    expect(response.status).toBe(200);
    const expectedStages = buildPipelineStagePngs(mask, STAGE_PLACEHOLDER, STAGE_PLACEHOLDER);
    const strokes = strokesFromMask(mask)!;
    await expect(response.json()).resolves.toEqual({
      name: "Night Heron",
      story: "A heron stands against the sky.",
      strokes,
      stages: expectedStages,
      debug: buildServerGenerationDebug(mask, SAM3_META, undefined, strokes, "Night Heron", "A heron stands against the sky."),
    });

    const failed = await handleGenerateConstellation(request({ image }), async () => {
      throw new SegmentSubjectError("bad", "failed");
    });
    expect(failed.status).toBe(502);
    const payload = (await failed.json()) as { error: string };
    expect(payload.error).toBe("generation_failed");
    expect(JSON.stringify(payload)).not.toContain("bad");

    const unavailable = await handleGenerateConstellation(request({ image }), async () => {
      throw new SegmentSubjectError("down", "unavailable");
    });
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: "segmentation_unavailable" });

    const modelDown = await handleGenerateConstellation(request({ image }), async () => {
      throw new SegmentSubjectError("gated", "model_unavailable");
    });
    expect(modelDown.status).toBe(503);
    await expect(modelDown.json()).resolves.toEqual({ error: "segmentation_model_unavailable" });
  });

  it("rejects the wrong method, a foreign origin, a missing image, and an oversized body", async () => {
    expect((await handleGenerateConstellation(request({ image }, { method: "GET" }))).status).toBe(405);
    expect((await handleGenerateConstellation(request({ image }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await handleGenerateConstellation(request({ image, model: "other-model" }))).status).toBe(400);
    expect((await handleGenerateConstellation(request({ image }, { contentType: "text/plain" }))).status).toBe(415);
    expect((await handleGenerateConstellation(request({}))).status).toBe(400);
    expect((await handleGenerateConstellation(request(null, { raw: "x".repeat(MAX_REQUEST_BYTES + 1) }))).status).toBe(413);
  });

  it("accepts an optional subject prompt", async () => {
    const mask = plusMask();
    const response = await handleGenerateConstellation(request({ image, prompt: "heron" }), async (_image, prompt) => {
      expect(prompt).toBe("heron");
      return segmentFromMask(mask, "Heron", "A heron waits among the fixed stars.");
    });
    expect(response.status).toBe(200);
  });
});
