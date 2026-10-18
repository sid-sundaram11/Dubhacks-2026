import { CANDIDATE_MIN } from "../../domain/constants";
import type { CustomConstellation } from "../../domain/constellation";
import type {
  DrawingRequest,
  DrawingResponse,
  GenerationClientTrace,
  GenerationServerDebug,
  PipelineStageImages,
  SubjectImage,
} from "../../domain/generation";
import { snapStrokesToStars, type SnapStar } from "./snapStrokesToStars";

export type CreationResult =
  | { kind: "zoom-out" }
  | { kind: "unreachable" }
  | { kind: "segmentation-unavailable" }
  | { kind: "segmentation-model-unavailable" }
  | { kind: "segmentation-out-of-memory" }
  | { kind: "no-subject" }
  | { kind: "timeout" }
  | { kind: "failed" }
  | {
      kind: "constellation";
      constellation: CustomConstellation;
      stageImages?: PipelineStageImages;
      serverDebug?: GenerationServerDebug;
      clientTrace: GenerationClientTrace;
    };

function serverUnreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /could not connect|network request failed|failed to connect|network error/i.test(message);
}

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `constellation-${sequence}`;
}

export async function createConstellation(input: {
  image: SubjectImage;
  prompt?: string;
  candidates: readonly SnapStar[];
  viewportWidth: number;
  viewportHeight: number;
  fov: number;
  request: (body: DrawingRequest) => Promise<DrawingResponse>;
}): Promise<CreationResult> {
  if (input.candidates.length < CANDIDATE_MIN) return { kind: "zoom-out" };

  try {
    const trimmedPrompt = input.prompt?.trim();
    const response = await input.request({
      image: input.image,
      ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
    });
    const segments = snapStrokesToStars(response.strokes, input.candidates);
    if (!segments || segments.length === 0) return { kind: "failed" };
    const name = response.name.trim();
    return {
      kind: "constellation",
      constellation: {
        id: nextId(),
        prompt: trimmedPrompt ?? name,
        name,
        story: response.story.trim(),
        segments,
        source: "sam3",
      },
      ...(response.stages ? { stageImages: response.stages } : {}),
      ...(response.debug ? { serverDebug: response.debug } : {}),
      clientTrace: {
        candidateCount: input.candidates.length,
        fov: input.fov,
        viewportWidth: input.viewportWidth,
        viewportHeight: input.viewportHeight,
        segments,
      },
    };
  } catch (error) {
    if (serverUnreachable(error)) return { kind: "unreachable" };
    if (error instanceof Error && error.name === "AbortError") return { kind: "timeout" };
    if (error instanceof Error && error.message === "timeout") return { kind: "timeout" };
    if (error instanceof Error && error.message === "segmentation_unavailable") {
      return { kind: "segmentation-unavailable" };
    }
    if (error instanceof Error && error.message === "segmentation_model_unavailable") {
      return { kind: "segmentation-model-unavailable" };
    }
    if (error instanceof Error && error.message === "segmentation_out_of_memory") {
      return { kind: "segmentation-out-of-memory" };
    }
    if (error instanceof Error && error.message === "no_subject") return { kind: "no-subject" };
  }
  return { kind: "failed" };
}
