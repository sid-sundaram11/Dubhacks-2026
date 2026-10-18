import { GENERATION_ATTEMPT_MS } from "../src/domain/constants";
import type { SubjectImage } from "../src/domain/generation";

export interface Sam3SegmentResponse {
  width: number;
  height: number;
  mask: string;
  overlay?: string;
  label?: string;
  confidence?: number;
}

export class Sam3ClientError extends Error {
  constructor(
    message: string,
    readonly code: "connection" | "model_unavailable" | "segmentation",
    readonly status?: number,
  ) {
    super(message);
    this.name = "Sam3ClientError";
  }
}

function sam3BaseUrl(): string {
  return (process.env.SAM3_URL ?? "http://127.0.0.1:8790").replace(/\/$/, "");
}

export async function segmentWithSam3(image: SubjectImage, prompt?: string): Promise<Sam3SegmentResponse> {
  const body: Record<string, string> = {
    mimeType: image.mimeType,
    data: image.data,
  };
  const trimmed = prompt?.trim();
  if (trimmed) body.prompt = trimmed;

  let response: Response;
  try {
    response = await fetch(`${sam3BaseUrl()}/segment`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GENERATION_ATTEMPT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw error;
    throw new Sam3ClientError("sam3_unreachable", "connection");
  }

  const payload = (await response.json().catch(() => ({}))) as Partial<Sam3SegmentResponse> & { error?: string };
  if (response.status === 503 && payload.error === "model_unavailable") {
    throw new Sam3ClientError("model_unavailable", "model_unavailable", response.status);
  }
  if (response.status === 503) {
    throw new Sam3ClientError(payload.error ?? "segmentation_unavailable", "connection", response.status);
  }
  if (!response.ok) {
    throw new Sam3ClientError(payload.error ?? "segmentation_failed", "segmentation", response.status);
  }
  if (!payload.mask || typeof payload.width !== "number" || typeof payload.height !== "number") {
    throw new Sam3ClientError("invalid_sam3_response", "segmentation", response.status);
  }
  return payload as Sam3SegmentResponse;
}
