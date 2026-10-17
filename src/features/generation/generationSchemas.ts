import { z } from "zod";
import { CANDIDATE_MAX, CANDIDATE_MIN, MAX_SEGMENTS, PROMPT_MAX, PROMPT_MIN } from "../../domain/constants";

const unit = z.number().finite().min(0).max(1);

export const candidateSchema = z.object({
  id: z.number().int(),
  x: unit,
  y: unit,
  brightness: unit,
});

export const drawingRequestSchema = z
  .strictObject({
    prompt: z.string(),
    stars: z.array(candidateSchema),
  })
  .superRefine((value, ctx) => {
    const prompt = value.prompt.trim();
    if (prompt.length < PROMPT_MIN || prompt.length > PROMPT_MAX) {
      ctx.addIssue({ code: "custom", message: "Prompt must be 1–120 characters.", path: ["prompt"] });
    }
    if (value.stars.length < CANDIDATE_MIN || value.stars.length > CANDIDATE_MAX) {
      ctx.addIssue({ code: "custom", message: "Candidate count must be 40–150.", path: ["stars"] });
    }
    const ids = new Set<number>();
    for (const star of value.stars) {
      if (ids.has(star.id)) {
        ctx.addIssue({ code: "custom", message: "Star ids must be unique.", path: ["stars"] });
        break;
      }
      ids.add(star.id);
    }
  });

const pointSchema = z.object({ x: unit, y: unit });

export const drawingResponseSchema = z
  .object({
    name: z.string(),
    story: z.string(),
    strokes: z.array(z.object({ points: z.array(pointSchema) })),
  })
  .superRefine((value, ctx) => {
    const name = value.name.trim();
    const story = value.story.trim();
    if (name.length < 1 || name.length > 48) {
      ctx.addIssue({ code: "custom", message: "Name must be 1–48 characters.", path: ["name"] });
    }
    const enders = story.match(/[.!?]/g);
    if (story.length < 1 || story.length > 160 || enders?.length !== 1 || !/[.!?]$/.test(story)) {
      ctx.addIssue({ code: "custom", message: "Story must be one sentence of 1–160 characters.", path: ["story"] });
    }
    if (value.strokes.length < 1 || value.strokes.length > 4) {
      ctx.addIssue({ code: "custom", message: "Use 1–4 strokes.", path: ["strokes"] });
    }
    let edges = 0;
    for (const stroke of value.strokes) {
      if (stroke.points.length < 2 || stroke.points.length > 7) {
        ctx.addIssue({ code: "custom", message: "Each stroke needs 2–7 points.", path: ["strokes"] });
      }
      edges += Math.max(0, stroke.points.length - 1);
    }
    if (edges < 6 || edges > MAX_SEGMENTS) {
      ctx.addIssue({ code: "custom", message: "Total edges must be 6–16.", path: ["strokes"] });
    }
  });

export const drawingResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "story", "strokes"],
  properties: {
    name: { type: "string" },
    story: { type: "string" },
    strokes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["points"],
        properties: {
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y"],
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const MAX_REQUEST_BYTES = 48_000;
