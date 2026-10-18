import { z } from "zod";
import { FOV_MAX, FOV_MIN, PROMPT_MAX } from "../../domain/constants";

const segmentSchema = z.object({
  fromStarId: z.number().int().positive().finite(),
  toStarId: z.number().int().positive().finite(),
}).refine((segment) => segment.fromStarId !== segment.toStarId, {
  message: "segment endpoints must differ",
});

const quaternionSchema = z
  .tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ])
  .refine((q) => {
    const length = Math.hypot(q[0], q[1], q[2], q[3]);
    return length > 1e-8;
  });

const aimSchema = z.object({
  quaternion: quaternionSchema,
  fov: z.number().finite().min(FOV_MIN).max(FOV_MAX),
});

export const MAX_ROOM_SEGMENTS = 400;
const shortText = z.string().max(200);
const storyText = z.string().max(500);
const promptText = z.string().max(PROMPT_MAX);

export const roomDocumentSchema = z.object({
  version: z.literal(1),
  hostUid: z.string().min(1).max(128),
  createdAt: z.unknown(),
});

export const roomMemberDocumentSchema = z.object({
  version: z.literal(1),
  uid: z.string().min(1).max(128),
  label: z.string().min(1).max(64),
  joinedAt: z.unknown(),
});

export const roomConstellationDocumentSchema = z.object({
  version: z.literal(1),
  ownerUid: z.string().min(1).max(128),
  ownerLabel: z.string().min(1).max(64),
  clientConstellationId: z.string().min(1).max(128),
  name: shortText,
  story: storyText,
  prompt: promptText,
  source: z.enum(["sam3", "fallback", "manual"]),
  segments: z.array(segmentSchema).max(MAX_ROOM_SEGMENTS),
  aim: aimSchema,
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});

export type RoomDocument = z.infer<typeof roomDocumentSchema>;
export type RoomMemberDocument = z.infer<typeof roomMemberDocumentSchema>;
export type RoomConstellationDocument = z.infer<typeof roomConstellationDocumentSchema>;
