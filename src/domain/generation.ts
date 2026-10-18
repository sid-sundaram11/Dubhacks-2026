import type { GeneratedStroke } from "./constellation";

export interface SubjectImage {
  mimeType: "image/jpeg" | "image/png";
  data: string;
}

export interface DrawingRequest {
  image: SubjectImage;
  prompt?: string;
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
  | "segmentation_unavailable"
  | "segmentation_model_unavailable"
  | "timeout";
