import { z } from "zod";
import { MASK_SIZE, PROMPT_MAX } from "../../domain/constants";

const unit = z.number().finite().min(0).max(1);

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(8);

export const drawingRequestSchema = z.strictObject({
  image: z.strictObject({
    mimeType: z.enum(["image/jpeg", "image/png"]),
    data: base64,
  }),
  prompt: z.string().trim().min(1).max(PROMPT_MAX).optional(),
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

export const pipelineStagesSchema = z.object({
  found: base64,
  mask: base64,
  grid: base64,
  skeleton: base64,
  nodes: base64,
});

const maskGridRow = z.array(z.number().int().min(0).max(1)).length(MASK_SIZE);

export const generationServerDebugSchema = z.object({
  prompt: z.string().optional(),
  sam3: z.object({
    maskWidth: z.number().int().positive(),
    maskHeight: z.number().int().positive(),
    label: z.string().optional(),
    confidence: z.number().optional(),
  }),
  maskGrid: z.array(maskGridRow).length(MASK_SIZE),
  skeleton: z.object({
    endpoints: z.number().int().nonnegative(),
    junctions: z.number().int().nonnegative(),
    fittedStrokeCount: z.number().int().nonnegative(),
    outputStrokeCount: z.number().int().nonnegative(),
    outputEdgeCount: z.number().int().nonnegative(),
  }),
  name: z.string(),
  story: z.string(),
  strokes: z.array(z.object({ points: z.array(pointSchema) })),
});

const drawingBodySchema = z.object({
  name: z.string(),
  story: z.string(),
  strokes: z.array(z.object({ points: z.array(pointSchema) })),
});

export const drawingResponseSchema = drawingBodySchema.superRefine((value, ctx) => {
  refineCopy(value.name, value.story, ctx);
  if (value.strokes.length < 1) {
    ctx.addIssue({ code: "custom", message: "Use at least one stroke.", path: ["strokes"] });
  }
  for (const stroke of value.strokes) {
    if (stroke.points.length < 2) {
      ctx.addIssue({ code: "custom", message: "Each stroke needs at least two points.", path: ["strokes"] });
    }
  }
});

export const drawingApiResponseSchema = drawingBodySchema
  .extend({
    stages: pipelineStagesSchema.optional(),
    debug: generationServerDebugSchema.optional(),
  })
  .superRefine((value, ctx) => {
    refineCopy(value.name, value.story, ctx);
    if (value.strokes.length < 1) {
      ctx.addIssue({ code: "custom", message: "Use at least one stroke.", path: ["strokes"] });
    }
    for (const stroke of value.strokes) {
      if (stroke.points.length < 2) {
        ctx.addIssue({ code: "custom", message: "Each stroke needs at least two points.", path: ["strokes"] });
      }
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
