import type { Timestamp } from "firebase/firestore";
import type { CustomConstellation } from "../../domain/constellation";
import type { SkyAim } from "../starfield/skyController";
import { normalizeSkyAim } from "./aimNormalize";
import {
  roomConstellationDocumentSchema,
  roomMemberDocumentSchema,
  type RoomConstellationDocument,
  type RoomMemberDocument,
} from "./roomSchemas";
import type { RoomConstellation, RoomMember } from "./roomReducer";

function timestampToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export function mapMemberDocument(data: unknown, docId: string): RoomMember | null {
  const parsed = roomMemberDocumentSchema.safeParse(data);
  if (!parsed.success) return null;
  const doc: RoomMemberDocument = parsed.data;
  if (doc.uid !== docId) return null;
  return { uid: doc.uid, label: doc.label };
}

export function mapConstellationDocument(
  sharedId: string,
  data: unknown,
  fallbackAim: SkyAim,
): RoomConstellation | null {
  const parsed = roomConstellationDocumentSchema.safeParse(data);
  if (!parsed.success) return null;
  const doc: RoomConstellationDocument = parsed.data;
  const aim = normalizeSkyAim(doc.aim, fallbackAim);
  return {
    sharedId,
    ownerUid: doc.ownerUid,
    ownerLabel: doc.ownerLabel,
    clientConstellationId: doc.clientConstellationId,
    name: doc.name,
    story: doc.story,
    prompt: doc.prompt,
    source: doc.source,
    segments: doc.segments,
    aim,
    createdAt: timestampToDate(doc.createdAt),
  };
}

export function roomConstellationToCustom(constellation: RoomConstellation): CustomConstellation {
  return {
    id: constellation.clientConstellationId,
    prompt: constellation.prompt,
    name: constellation.name,
    story: constellation.story,
    segments: constellation.segments,
    source: constellation.source,
  };
}

export type ConstellationWritePayload = Omit<RoomConstellationDocument, "createdAt" | "updatedAt">;

export function buildConstellationPayload(input: {
  constellation: CustomConstellation;
  aim: SkyAim;
  ownerUid: string;
  ownerLabel: string;
}): ConstellationWritePayload {
  return {
    version: 1,
    ownerUid: input.ownerUid,
    ownerLabel: input.ownerLabel,
    clientConstellationId: input.constellation.id,
    name: input.constellation.name,
    story: input.constellation.story,
    prompt: input.constellation.prompt,
    source: input.constellation.source,
    segments: input.constellation.segments,
    aim: {
      quaternion: [...input.aim.quaternion],
      fov: input.aim.fov,
    },
  };
}
