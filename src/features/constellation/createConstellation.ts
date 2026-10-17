import { CANDIDATE_MIN } from "../../domain/constants";
import type { CustomConstellation } from "../../domain/constellation";
import type { DrawingRequest, DrawingResponse } from "../../domain/generation";
import { fallbackForPrompt, ORION_FALLBACK_COPY, ORION_FALLBACK_SEGMENTS } from "./fallbackShapes";
import { snapStrokesToStars, type SnapStar } from "./snapStrokesToStars";

export type CreationResult =
  | { kind: "zoom-out" }
  | {
      kind: "constellation";
      constellation: CustomConstellation;
      resetSky: boolean;
      offline: boolean;
    };

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `constellation-${sequence}`;
}

export async function createConstellation(input: {
  prompt: string;
  candidates: readonly SnapStar[];
  request: (body: DrawingRequest) => Promise<DrawingResponse>;
}): Promise<CreationResult> {
  if (input.candidates.length < CANDIDATE_MIN) return { kind: "zoom-out" };
  const stars = input.candidates.map((star) => ({
    id: star.id,
    x: star.x,
    y: star.y,
    brightness: star.brightness,
  }));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await input.request({ prompt: input.prompt, stars });
      const segments = snapStrokesToStars(response.strokes, input.candidates);
      if (segments) {
        return {
          kind: "constellation",
          resetSky: false,
          offline: false,
          constellation: {
            id: nextId(),
            prompt: input.prompt,
            name: response.name.trim(),
            story: response.story.trim(),
            segments,
            source: "gemini",
          },
        };
      }
    } catch {
      // Retry once, then fall through to the offline template.
    }
  }

  const template = fallbackForPrompt(input.prompt);
  const snapped = snapStrokesToStars(template.strokes, input.candidates);
  if (snapped) {
    return {
      kind: "constellation",
      resetSky: false,
      offline: true,
      constellation: {
        id: nextId(),
        prompt: input.prompt,
        name: template.name,
        story: template.story,
        segments: snapped,
        source: "fallback",
      },
    };
  }

  return {
    kind: "constellation",
    resetSky: true,
    offline: true,
    constellation: {
      id: nextId(),
      prompt: input.prompt,
      name: ORION_FALLBACK_COPY.name,
      story: ORION_FALLBACK_COPY.story,
      segments: ORION_FALLBACK_SEGMENTS,
      source: "fallback",
    },
  };
}
