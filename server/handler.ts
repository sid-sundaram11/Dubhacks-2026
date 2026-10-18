import type { GenerationErrorCode } from "../src/domain/generation";
import { drawingRequestSchema, drawingResponseSchema, MAX_REQUEST_BYTES } from "../src/features/generation/generationSchemas";
import type { SegmentSubject } from "./segmentation/contract";
import { defaultSegmentSubject, SegmentSubjectError } from "./segmentation/segmentSubject";
import { strokesFromMask } from "./skeleton";

export type { SegmentSubject };

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": process.env.ALLOWED_ORIGIN?.trim() || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    "cache-control": "no-store",
  };
}

function errorResponse(status: number, error: GenerationErrorCode): Response {
  return Response.json({ error }, { status, headers: corsHeaders() });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = process.env.ALLOWED_ORIGIN?.trim();
  if (allowed) return origin === allowed;
  return origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
}

export async function handleGenerateConstellation(
  request: Request,
  segment: SegmentSubject = defaultSegmentSubject,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return errorResponse(405, "method_not_allowed");
  if (!originAllowed(request)) return errorResponse(403, "forbidden_origin");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return errorResponse(415, "unsupported_media_type");

  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) return errorResponse(413, "payload_too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, "invalid_request");
  }
  const parsed = drawingRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "invalid_request");

  try {
    const { name, story, mask } = await segment(parsed.data.image, parsed.data.prompt);
    const strokes = strokesFromMask(mask);
    const drawing = drawingResponseSchema.safeParse({
      name: name.trim(),
      story: story.trim(),
      strokes,
    });
    if (!strokes || !drawing.success) return errorResponse(502, "generation_failed");
    return Response.json(
      {
        name: drawing.data.name.trim(),
        story: drawing.data.story.trim(),
        strokes: drawing.data.strokes,
      },
      { headers: corsHeaders() },
    );
  } catch (error) {
    if (error instanceof SegmentSubjectError) {
      if (error.kind === "unavailable") return errorResponse(503, "segmentation_unavailable");
      if (error.kind === "model_unavailable") return errorResponse(503, "segmentation_model_unavailable");
      return errorResponse(502, "generation_failed");
    }
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") return errorResponse(504, "timeout");
    return errorResponse(502, "generation_failed");
  }
}
