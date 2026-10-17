import { z } from "zod";
import { MASK_SIZE, MAX_SEGMENTS, MIN_SEGMENTS } from "../../domain/constants";

const unit = z.number().finite().min(0).max(1);

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(8);

export const drawingRequestSchema = z.strictObject({
  image: z.strictObject({
    mimeType: z.enum(["image/jpeg", "image/png"]),
    data: base64,
  }),
});

function refineCopy(name: string, story: string, ctx: z.RefinementCtx): void {
  const trimmedName = name.trim();
  const trimmedStory = story.trim();
  if (trimmedName.length < 1 || trimmedName.length > 48) {
    ctx.addIssue({ code: "custom", message: "Name must be 1–48 characters.", path: ["name"] });
  }
  const enders = trimmedStory.match(/[.!?]/g);
  if (trimmedStory.length < 1 || trimmedStory.length > 160 || enders?.length !== 1 || !/[.!?]$/.test(trimmedStory)) {
    ctx.addIssue({ code: "custom", message: "Story must be one sentence of 1–160 characters.", path: ["story"] });
  }
}

const pointSchema = z.object({ x: unit, y: unit });

const maskRow = z.array(z.number().int().min(0).max(1)).length(MASK_SIZE);

export const maskResponseSchema = z
  .object({
    name: z.string(),
    story: z.string(),
    mask: z.array(maskRow).length(MASK_SIZE),
  })
  .superRefine((value, ctx) => refineCopy(value.name, value.story, ctx));

export const drawingResponseSchema = z
  .object({
    name: z.string(),
    story: z.string(),
    strokes: z.array(z.object({ points: z.array(pointSchema) })),
  })
  .superRefine((value, ctx) => {
    refineCopy(value.name, value.story, ctx);
    if (value.strokes.length < 1 || value.strokes.length > MAX_SEGMENTS) {
      ctx.addIssue({ code: "custom", message: "Use 1–16 strokes.", path: ["strokes"] });
    }
    let edges = 0;
    for (const stroke of value.strokes) {
      if (stroke.points.length < 2 || stroke.points.length > 7) {
        ctx.addIssue({ code: "custom", message: "Each stroke needs 2–7 points.", path: ["strokes"] });
      }
      edges += Math.max(0, stroke.points.length - 1);
    }
    if (edges < MIN_SEGMENTS || edges > MAX_SEGMENTS) {
      ctx.addIssue({ code: "custom", message: "Total edges must be 4–16.", path: ["strokes"] });
    }
  });

export const maskResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "story", "mask"],
  properties: {
    name: { type: "string" },
    story: { type: "string" },
    mask: {
      type: "array",
      minItems: MASK_SIZE,
      maxItems: MASK_SIZE,
      items: {
        type: "array",
        minItems: MASK_SIZE,
        maxItems: MASK_SIZE,
        items: { type: "integer", minimum: 0, maximum: 1 },
      },
    },
  },
} as const;

export const MAX_REQUEST_BYTES = 1_500_000;
