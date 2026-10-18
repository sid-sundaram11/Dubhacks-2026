import type { ConstellationSegment, GeneratedStroke } from "./constellation";

export interface SubjectImage {
  mimeType: "image/jpeg" | "image/png";
  data: string;
}

export interface DrawingRequest {
  image: SubjectImage;
  prompt?: string;
}

export interface PipelineStageImages {
  found: string;
  mask: string;
  grid: string;
  skeleton: string;
  nodes: string;
}

export interface GenerationServerDebug {
  prompt?: string;
  sam3: {
    maskWidth: number;
    maskHeight: number;
    label?: string;
    confidence?: number;
  };
  maskGrid: number[][];
  skeleton: {
    endpoints: number;
    junctions: number;
    fittedStrokeCount: number;
    outputStrokeCount: number;
    outputEdgeCount: number;
  };
  name: string;
  story: string;
  strokes: GeneratedStroke[];
}

export interface GenerationClientTrace {
  candidateCount: number;
  fov: number;
  viewportWidth: number;
  viewportHeight: number;
  segments: ConstellationSegment[];
}

export interface GenerationTrace {
  stages: PipelineStageImages;
  server?: GenerationServerDebug;
  client: GenerationClientTrace;
}

export interface DrawingResponse {
  name: string;
  story: string;
  strokes: GeneratedStroke[];
  stages?: PipelineStageImages;
  debug?: GenerationServerDebug;
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
