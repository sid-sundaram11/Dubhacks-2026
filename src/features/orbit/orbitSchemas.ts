import { z } from "zod";
import { FOV_MAX, FOV_MIN } from "../../domain/constants";

export const HYG_CATALOG_VERSION = "v1" as const;

export const PHASES = ["gathering", "comet", "solving", "archived"] as const;
export const phaseSchema = z.enum(PHASES);
export type OrbitPhase = z.infer<typeof phaseSchema>;

export const segmentSchema = z
  .object({
    fromStarId: z.number().int().positive().finite(),
    toStarId: z.number().int().positive().finite(),
  })
  .refine((segment) => segment.fromStarId !== segment.toStarId, {
    message: "segment endpoints must differ",
  });

export const aimTupleSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

export const memorySchema = z.strictObject({
  submissionId: z.uuid(),
  constellationId: z.uuid(),
  catalogVersion: z.literal(HYG_CATALOG_VERSION),
  name: z.string().min(1),
  story: z.string().min(1),
  caption: z.string().nullable(),
  description: z.string().nullable(),
  imagePath: z.string().nullable(),
  aim: aimTupleSchema.nullable(),
  fov: z.number().nullable(),
  segments: z.array(segmentSchema).min(1).max(400),
});
export type OrbitMemory = z.infer<typeof memorySchema>;

export const assignmentViewSchema = z.strictObject({
  id: z.uuid(),
  prompt: z.string(),
  assigneeId: z.uuid(),
  submissionId: z.uuid().nullable(),
});

export const placementSchema = z.strictObject({
  submissionId: z.uuid(),
  ring: z.number().int().min(0).max(2),
  position: z.number().int().min(0).max(2),
  placedBy: z.uuid(),
});

export const boardSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  placements: z.array(placementSchema),
});
export type OrbitBoard = z.infer<typeof boardSchema>;

export const cycleSchema = z.strictObject({
  id: z.uuid(),
  orbitId: z.uuid(),
  weekKey: z.string(),
  themeTitle: z.string(),
  themePrompt: z.string(),
  phase: phaseSchema,
  assignments: z.array(assignmentViewSchema),
  memories: z.array(memorySchema),
  board: boardSchema,
});
export type OrbitCycle = z.infer<typeof cycleSchema>;

export const chapterSchema = z.strictObject({
  id: z.uuid(),
  cycleId: z.uuid(),
  orbitId: z.uuid(),
  themeTitle: z.string(),
  themePrompt: z.string(),
  createdAt: z.string(),
  memories: z.array(memorySchema),
});
export type MemoryChapter = z.infer<typeof chapterSchema>;

export const currentCycleSchema = z.strictObject({
  cycle: cycleSchema.nullable(),
  chapters: z.array(chapterSchema),
});

export const orbitMemberSchema = z.strictObject({ userId: z.uuid() });
export const orbitBodySchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  createdBy: z.uuid(),
  members: z.array(orbitMemberSchema),
});
export const currentOrbitSchema = z.strictObject({
  orbit: orbitBodySchema.nullable(),
});
export const createOrbitResponseSchema = z.strictObject({ orbit: orbitBodySchema });

export const anonymousAuthSchema = z.strictObject({
  userId: z.uuid(),
  accessToken: z.string().min(1),
  tokenType: z.literal("bearer"),
});

export const inviteResponseSchema = z.strictObject({
  code: z.string().length(6),
  orbitId: z.uuid(),
});

export const joinResponseSchema = z.strictObject({
  orbitId: z.uuid(),
  name: z.string(),
});

export const hapticSchema = z.strictObject({
  atMs: z.number().int().nonnegative(),
  intensity: z.enum(["soft", "medium", "strong"]),
  durationMs: z.number().int().positive(),
});

export const cometRevealSchema = z.strictObject({
  weekKey: z.string(),
  cached: z.boolean(),
  source: z.enum(["grok-imagine", "fallback"]),
  media: z.array(
    z.strictObject({
      kind: z.literal("image"),
      url: z.string().url(),
      contentType: z.literal("image/png"),
    }),
  ),
  haptics: z.array(hapticSchema).min(1),
});

export const finalizeResponseSchema = z.strictObject({
  submissionId: z.uuid(),
  constellationId: z.uuid(),
  idempotentReplay: z.boolean(),
});

export const checkRingResponseSchema = z.strictObject({
  correct: z.boolean(),
  archived: z.boolean(),
});

export const advancePhaseResponseSchema = z.strictObject({
  phase: phaseSchema,
  cometReady: z.boolean(),
});

export const createOrbitRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
});

export const inviteRequestSchema = z.strictObject({
  orbitId: z.uuid().optional(),
});

export const joinRequestSchema = z.strictObject({
  code: z.string().trim().min(1).max(16),
});

export const finalizeRequestSchema = z.strictObject({
  assignmentId: z.uuid(),
  segments: z.array(segmentSchema).min(1).max(400),
  name: z.string().trim().min(1).max(200),
  story: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  catalogVersion: z.literal(HYG_CATALOG_VERSION),
  imageBase64: z.string().max(1_500_000).nullable().optional(),
  aim: aimTupleSchema.nullable().optional(),
  fov: z.number().finite().min(FOV_MIN).max(FOV_MAX).nullable().optional(),
});
export type FinalizeRequest = z.infer<typeof finalizeRequestSchema>;

export const placeRequestSchema = z.strictObject({
  submissionId: z.uuid(),
  ring: z.number().int().min(0).max(2),
  position: z.number().int().min(0).max(2),
});

export const checkRingRequestSchema = z.strictObject({
  cycleId: z.uuid(),
  ring: z.number().int().min(0).max(2),
});

export const advancePhaseRequestSchema = z.strictObject({
  orbitId: z.uuid().optional(),
});

export const revealRequestSchema = z.strictObject({
  orbitId: z.uuid().optional(),
});
