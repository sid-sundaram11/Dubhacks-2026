import { GENERATION_ATTEMPT_MS } from "../../domain/constants";
import type { DrawingRequest, DrawingResponse } from "../../domain/generation";
import { drawingResponseSchema } from "./generationSchemas";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:8787";

export async function requestDrawing(body: DrawingRequest): Promise<DrawingResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_ATTEMPT_MS);
  try {
    const response = await fetch(`${API_BASE}/api/generate-constellation`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (response.status === 429) throw new Error("rate_limited");
    if (!response.ok) throw new Error("generation_failed");
    const parsed = drawingResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("invalid_response");
    return {
      name: parsed.data.name.trim(),
      story: parsed.data.story.trim(),
      strokes: parsed.data.strokes,
    };
  } finally {
    clearTimeout(timer);
  }
}
