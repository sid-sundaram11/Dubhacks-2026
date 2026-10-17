import type { StarId } from "./star";
import type { GeneratedStroke } from "./constellation";

export interface DrawingRequest {
  prompt: string;
  stars: Array<{
    id: StarId;
    x: number;
    y: number;
    brightness: number;
  }>;
}

export interface DrawingResponse {
  name: string;
  story: string;
  strokes: GeneratedStroke[];
}

export type GenerationErrorCode =
  | "method_not_allowed"
  | "unsupported_media_type"
  | "invalid_request"
  | "payload_too_large"
  | "forbidden_origin"
  | "generation_failed"
  | "timeout";
