import { describe, expect, it } from "vitest";
import { MASK_SIZE } from "../src/domain/constants";
import { MAX_REQUEST_BYTES } from "../src/features/generation/generationSchemas";
import { handleGenerateConstellation } from "./handler";
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
  fill(mask, 8, 20, 39, 27);
  fill(mask, 20, 8, 27, 39);
  return mask;
}

const image = { mimeType: "image/jpeg" as const, data: Buffer.from("constellation-photo").toString("base64") };

describe("generate constellation handler", () => {
  it("turns a subject mask into skeleton strokes and hides model failures", async () => {
    const mask = plusMask();
    const response = await handleGenerateConstellation(request({ image }), async () =>
      JSON.stringify({ name: "Night Heron", story: "A heron stands against the sky.", mask }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: "Night Heron",
      story: "A heron stands against the sky.",
      strokes: strokesFromMask(mask),
    });

    const failed = await handleGenerateConstellation(request({ image }), async () => {
      throw new Error("secret-should-not-leak");
    });
    expect(failed.status).toBe(502);
    const payload = (await failed.json()) as { error: string };
    expect(payload.error).toBe("generation_failed");
    expect(JSON.stringify(payload)).not.toContain("secret");

    const limited = await handleGenerateConstellation(request({ image }), async () => {
      throw Object.assign(new Error("quota exceeded"), { status: 429 });
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({ error: "rate_limited" });
  });

  it("rejects the wrong method, a foreign origin, a missing image, and an oversized body", async () => {
    expect((await handleGenerateConstellation(request({ image }, { method: "GET" }))).status).toBe(405);
    expect((await handleGenerateConstellation(request({ image }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await handleGenerateConstellation(request({ image, model: "other-model" }))).status).toBe(400);
    expect((await handleGenerateConstellation(request({ image }, { contentType: "text/plain" }))).status).toBe(415);
    expect((await handleGenerateConstellation(request({}))).status).toBe(400);
    expect((await handleGenerateConstellation(request(null, { raw: "x".repeat(MAX_REQUEST_BYTES + 1) }))).status).toBe(413);
  });
});
