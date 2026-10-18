import type { OrbitPhase } from "../../src/features/orbit/orbitSchemas";

export interface Profile {
  id: string;
  createdAt: string;
}

export interface OrbitRecord {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface MemberRecord {
  orbitId: string;
  userId: string;
  joinedAt: string;
}

export interface InviteRecord {
  code: string;
  orbitId: string;
  createdBy: string;
  createdAt: string;
}

export interface CycleRecord {
  id: string;
  orbitId: string;
  weekKey: string;
  themeTitle: string;
  themePrompt: string;
  phase: OrbitPhase;
  boardVersion: number;
  createdAt: string;
}

export interface ThreadRecord {
  id: string;
  cycleId: string;
  slot: 1 | 2 | 3;
  answerKey: string;
}

export interface AssignmentRecord {
  id: string;
  cycleId: string;
  orbitId: string;
  threadId: string;
  assigneeId: string;
  prompt: string;
  slot: number;
}

export interface ConstellationRecord {
  id: string;
  orbitId: string;
  ownerId: string;
  catalogVersion: "v1";
  name: string;
  story: string;
  caption: string | null;
  description: string | null;
  imagePath: string | null;
  aim: [number, number, number, number] | null;
  fov: number | null;
  segments: { fromStarId: number; toStarId: number }[];
  createdAt: string;
}

export interface SubmissionRecord {
  id: string;
  assignmentId: string;
  constellationId: string;
  userId: string;
  finalizedAt: string;
}

export interface PlacementRecord {
  cycleId: string;
  orbitId: string;
  submissionId: string;
  ring: number;
  position: number;
  placedBy: string;
  placedAt: string;
}

export interface ArchiveRecord {
  id: string;
  cycleId: string;
  orbitId: string;
  themeTitle: string;
  themePrompt: string;
  createdAt: string;
  memories: {
    submissionId: string;
    constellationId: string;
    catalogVersion: "v1";
    name: string;
    story: string;
    caption: string | null;
    description: string | null;
    imagePath: string | null;
    aim: [number, number, number, number] | null;
    fov: number | null;
    segments: { fromStarId: number; toStarId: number }[];
  }[];
}

export interface MediaRecord {
  path: string;
  bytesBase64: string;
  contentType: string;
}

export interface HapticBeat {
  atMs: number;
  intensity: "soft" | "medium" | "strong";
  durationMs: number;
}

export interface CometRecord {
  weekKey: string;
  source: "grok-imagine" | "fallback";
  path: string;
  contentType: "image/png";
  haptics: HapticBeat[];
}

export interface OrbitDb {
  profiles: Profile[];
  orbits: OrbitRecord[];
  members: MemberRecord[];
  invites: InviteRecord[];
  cycles: CycleRecord[];
  threads: ThreadRecord[];
  assignments: AssignmentRecord[];
  constellations: ConstellationRecord[];
  submissions: SubmissionRecord[];
  placements: PlacementRecord[];
  archives: ArchiveRecord[];
  comets: CometRecord[];
  media: MediaRecord[];
}

export function emptyOrbitDb(): OrbitDb {
  return {
    profiles: [],
    orbits: [],
    members: [],
    invites: [],
    cycles: [],
    threads: [],
    assignments: [],
    constellations: [],
    submissions: [],
    placements: [],
    archives: [],
    comets: [],
    media: [],
  };
}
