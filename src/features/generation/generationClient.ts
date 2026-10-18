import { GENERATION_ATTEMPT_MS } from "../../domain/constants";
import type { DrawingRequest, DrawingResponse } from "../../domain/generation";
import { drawingApiResponseSchema, drawingResponseSchema } from "./generationSchemas";

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
    if (response.status === 503) {
      const code =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error: unknown }).error)
          : "segmentation_unavailable";
      throw new Error(code === "segmentation_model_unavailable" ? code : "segmentation_unavailable");
    }
    if (!response.ok) throw new Error("generation_failed");
    const drawing = drawingResponseSchema.safeParse(payload);
    if (!drawing.success) throw new Error("invalid_response");
    const extra = drawingApiResponseSchema.safeParse(payload);
    return {
      name: drawing.data.name.trim(),
      story: drawing.data.story.trim(),
      strokes: drawing.data.strokes,
      ...(extra.success && extra.data.stages ? { stages: extra.data.stages } : {}),
      ...(extra.success && extra.data.debug ? { debug: extra.data.debug } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}
