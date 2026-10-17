import { describe, expect, it } from "vitest";
import { handleGenerateConstellation } from "./handler";

function request(body: unknown, init?: { method?: string; origin?: string; contentType?: string }) {
  return new Request("http://127.0.0.1:8787/api/generate-constellation", {
    method: init?.method ?? "POST",
    headers: {
      "content-type": init?.contentType ?? "application/json",
      ...(init?.origin ? { origin: init.origin } : {}),
    },
    body: init?.method === "GET" ? undefined : JSON.stringify(body),
  });
}

const stars = Array.from({ length: 40 }, (_, index) => ({ id: index + 1, x: 0.2, y: 0.3, brightness: 0.4 }));
const validDrawing = {
  name: "Raised Dragon",
  story: "A dragon lifts its wings.",
  strokes: [
    {
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.3 },
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.4 },
        { x: 0.7, y: 0.3 },
        { x: 0.8, y: 0.2 },
      ],
    },
  ],
};

describe("generate constellation handler", () => {
  it("returns a validated drawing and hides model failures", async () => {
    const response = await handleGenerateConstellation(request({ prompt: "Dragon", stars }), async () => JSON.stringify(validDrawing));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "Raised Dragon" });

    const failed = await handleGenerateConstellation(request({ prompt: "Dragon", stars }), async () => {
      throw new Error("secret-should-not-leak");
    });
    expect(failed.status).toBe(502);
    const payload = (await failed.json()) as { error: string };
    expect(payload.error).toBe("generation_failed");
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("rejects the wrong method, a foreign origin, and extra model controls", async () => {
    expect((await handleGenerateConstellation(request({ prompt: "Dragon", stars }, { method: "GET" }))).status).toBe(405);
    expect((await handleGenerateConstellation(request({ prompt: "Dragon", stars }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await handleGenerateConstellation(request({ prompt: "Dragon", stars, model: "other-model" }))).status).toBe(400);
    expect((await handleGenerateConstellation(request({ prompt: "Dragon", stars }, { contentType: "text/plain" }))).status).toBe(415);
  });
});
