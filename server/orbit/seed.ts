import { ORION_FALLBACK_IDS } from "../../src/domain/constants";
import { HYG_CATALOG_VERSION } from "../../src/features/orbit/orbitSchemas";
import { emptyOrbitDb, type OrbitDb } from "./types";
import { ASSIGNMENT_PROMPTS, balancedAssignees, hiddenAnswerKey, themeForWeek, threadSlot } from "./week";

export const SEED_USER_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
] as const;

export const SEED_ORBIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const SEED_CYCLE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SEED_ARCHIVE_CYCLE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const SEED_ARCHIVE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const SEED_INVITE_CODE = "STAR42";
export const SEED_WEEK_KEY = "2026-W42";

const PAIRS: [number, number][] = [
  [ORION_FALLBACK_IDS.rigel, ORION_FALLBACK_IDS.bellatrix],
  [ORION_FALLBACK_IDS.bellatrix, ORION_FALLBACK_IDS.mintaka],
  [ORION_FALLBACK_IDS.mintaka, ORION_FALLBACK_IDS.alnilam],
  [ORION_FALLBACK_IDS.alnilam, ORION_FALLBACK_IDS.alnitak],
  [ORION_FALLBACK_IDS.alnitak, ORION_FALLBACK_IDS.saiph],
  [ORION_FALLBACK_IDS.saiph, ORION_FALLBACK_IDS.betelgeuse],
  [ORION_FALLBACK_IDS.betelgeuse, ORION_FALLBACK_IDS.rigel],
  [ORION_FALLBACK_IDS.rigel, ORION_FALLBACK_IDS.alnilam],
  [ORION_FALLBACK_IDS.mintaka, ORION_FALLBACK_IDS.saiph],
];

const NAMES = [
  "North Window",
  "Second Chair",
  "Late Train",
  "Blue Kettle",
  "Porch Light",
  "Shared Coat",
  "Sunday Bowl",
  "Quiet Stair",
  "Paper Moon",
];

function seedUuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export function demoSnapshot(): OrbitDb {
  const db = emptyOrbitDb();
  const created = "2026-10-18T00:00:00.000Z";
  for (const id of SEED_USER_IDS) db.profiles.push({ id, createdAt: created });
  db.orbits.push({ id: SEED_ORBIT_ID, name: "North Window", createdBy: SEED_USER_IDS[0], createdAt: created });
  SEED_USER_IDS.forEach((userId, index) => {
    db.members.push({ orbitId: SEED_ORBIT_ID, userId, joinedAt: `2026-10-18T00:00:0${index}.000Z` });
  });
  db.invites.push({ code: SEED_INVITE_CODE, orbitId: SEED_ORBIT_ID, createdBy: SEED_USER_IDS[0], createdAt: created });

  db.cycles.push({
    id: SEED_ARCHIVE_CYCLE_ID,
    orbitId: SEED_ORBIT_ID,
    weekKey: "2026-W41",
    themeTitle: "The year we stayed",
    themePrompt: "A chapter that already closed.",
    phase: "archived",
    boardVersion: 0,
    createdAt: "2026-10-11T00:00:00.000Z",
  });
  db.archives.push({
    id: SEED_ARCHIVE_ID,
    cycleId: SEED_ARCHIVE_CYCLE_ID,
    orbitId: SEED_ORBIT_ID,
    themeTitle: "The year we stayed",
    themePrompt: "A chapter that already closed.",
    createdAt: "2026-10-11T00:00:00.000Z",
    memories: [
      {
        submissionId: seedUuid(1),
        constellationId: seedUuid(2),
        catalogVersion: HYG_CATALOG_VERSION,
        name: "Closed Window",
        story: "The chapter kept its shape after the week ended.",
        caption: null,
        description: null,
        imagePath: null,
        aim: null,
        fov: null,
        segments: [{ fromStarId: ORION_FALLBACK_IDS.rigel, toStarId: ORION_FALLBACK_IDS.bellatrix }],
      },
    ],
  });

  const theme = themeForWeek(SEED_WEEK_KEY);
  db.cycles.push({
    id: SEED_CYCLE_ID,
    orbitId: SEED_ORBIT_ID,
    weekKey: SEED_WEEK_KEY,
    themeTitle: theme.title,
    themePrompt: theme.prompt,
    phase: "solving",
    boardVersion: 3,
    createdAt: created,
  });
  const threads = ([1, 2, 3] as const).map((slot) => {
    const thread = { id: seedUuid(400 + slot), cycleId: SEED_CYCLE_ID, slot, answerKey: hiddenAnswerKey(SEED_WEEK_KEY, slot) };
    db.threads.push(thread);
    return thread;
  });
  const assignees = balancedAssignees(SEED_USER_IDS, ASSIGNMENT_PROMPTS.length);
  ASSIGNMENT_PROMPTS.forEach((prompt, index) => {
    const slot = threadSlot(index);
    const thread = threads.find((item) => item.slot === slot)!;
    const constellationId = seedUuid(100 + index);
    const submissionId = seedUuid(200 + index);
    db.assignments.push({
      id: seedUuid(300 + index),
      cycleId: SEED_CYCLE_ID,
      orbitId: SEED_ORBIT_ID,
      threadId: thread.id,
      assigneeId: assignees[index]!,
      prompt,
      slot: index,
    });
    db.constellations.push({
      id: constellationId,
      orbitId: SEED_ORBIT_ID,
      ownerId: assignees[index]!,
      catalogVersion: HYG_CATALOG_VERSION,
      name: NAMES[index]!,
      story: `${NAMES[index]} is drawn between catalog stars.`,
      caption: null,
      description: null,
      imagePath: null,
      aim: index === 0 ? [0, 0, 0, 1] : null,
      fov: index === 0 ? 60 : null,
      segments: [{ fromStarId: PAIRS[index]![0], toStarId: PAIRS[index]![1] }],
      createdAt: created,
    });
    db.submissions.push({
      id: submissionId,
      assignmentId: seedUuid(300 + index),
      constellationId,
      userId: assignees[index]!,
      finalizedAt: created,
    });
  });
  [0, 3, 6].forEach((index, position) => {
    db.placements.push({
      cycleId: SEED_CYCLE_ID,
      orbitId: SEED_ORBIT_ID,
      submissionId: seedUuid(200 + index),
      ring: 0,
      position,
      placedBy: SEED_USER_IDS[0],
      placedAt: created,
    });
  });
  return db;
}
