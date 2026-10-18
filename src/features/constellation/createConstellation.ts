import { CANDIDATE_MIN } from "../../domain/constants";
import type { CustomConstellation } from "../../domain/constellation";
import type { DrawingRequest, DrawingResponse, SubjectImage } from "../../domain/generation";
import { snapStrokesToStars, type SnapStar } from "./snapStrokesToStars";

export type CreationResult =
  | { kind: "zoom-out" }
  | { kind: "unreachable" }
  | { kind: "segmentation-unavailable" }
  | { kind: "segmentation-model-unavailable" }
  | { kind: "failed" }
  | { kind: "constellation"; constellation: CustomConstellation };

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
  request: (body: DrawingRequest) => Promise<DrawingResponse>;
}): Promise<CreationResult> {
  if (input.candidates.length < CANDIDATE_MIN) return { kind: "zoom-out" };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const trimmedPrompt = input.prompt?.trim();
      const response = await input.request({
        image: input.image,
        ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
      });
      const segments = snapStrokesToStars(response.strokes, input.candidates);
      if (segments) {
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
        };
      }
    } catch (error) {
      if (serverUnreachable(error)) return { kind: "unreachable" };
      if (error instanceof Error && error.message === "segmentation_unavailable") {
        return { kind: "segmentation-unavailable" };
      }
      if (error instanceof Error && error.message === "segmentation_model_unavailable") {
        return { kind: "segmentation-model-unavailable" };
      }
    }
  }

  return { kind: "failed" };
}
