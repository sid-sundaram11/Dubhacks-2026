import { describe, expect, it, vi } from "vitest";
import { FOV_MIN, FOV_MAX, INITIAL_FOV } from "../domain/constants";
import { appReducer, initialAppState } from "../shell/appReducer";
import { normalizeSkyAim } from "../features/rooms/aimNormalize";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "../features/rooms/roomCode";
import { mapConstellationDocument, roomConstellationToCustom } from "../features/rooms/roomMapper";
import { roomConstellationDocumentSchema } from "../features/rooms/roomSchemas";
import { initialRoomState, roomReducer } from "../features/rooms/roomReducer";
import { roomErrorMessage } from "../features/rooms/roomError";
import { sharedConstellationDocumentId } from "../features/rooms/sharedDocumentId";
import type { SkyAim } from "../features/starfield/skyController";
import { SkyController } from "../features/starfield/skyController";

vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: async (length: number) => Uint8Array.from({ length }, (_, index) => index % 256),
}));

const fallbackAim: SkyAim = { quaternion: [0, 0, 0, 1], fov: INITIAL_FOV };

describe("room codes", () => {
  it("normalizes to uppercase alphanumeric without ambiguous padding", () => {
    expect(normalizeRoomCode(" ab-c1 ")).toBe("ABC1");
  });

  it("generates six characters from the allowed alphabet", async () => {
    const code = await generateRoomCode();
    expect(code.length).toBe(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(code)).toBe(true);
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET.includes(char)).toBe(true);
      expect("IO01".includes(char)).toBe(false);
    }
  });

  it("rejects invalid lengths and characters after normalization", () => {
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("ABCDE")).toBe(false);
    expect(isValidRoomCode("ABCD1O")).toBe(false);
  });
});

describe("room constellation schema", () => {
  const validDoc = {
    version: 1,
    ownerUid: "uid-1",
    ownerLabel: "Explorer AAAA",
    clientConstellationId: "constellation-1",
    name: "Sky Dog",
    story: "A loyal hound among the stars.",
    prompt: "dog",
    source: "sam3",
    segments: [{ fromStarId: 1, toStarId: 2 }],
    aim: { quaternion: [0, 0, 0, 1], fov: 60 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("accepts valid documents", () => {
    expect(roomConstellationDocumentSchema.safeParse(validDoc).success).toBe(true);
  });

  it("rejects invalid star ids, same-star segments, NaN, bad quaternions, and oversized strings", () => {
    expect(roomConstellationDocumentSchema.safeParse({ ...validDoc, segments: [{ fromStarId: 1, toStarId: 1 }] }).success).toBe(
      false,
    );
    expect(roomConstellationDocumentSchema.safeParse({ ...validDoc, segments: [{ fromStarId: NaN, toStarId: 2 }] }).success).toBe(
      false,
    );
    expect(
      roomConstellationDocumentSchema.safeParse({
        ...validDoc,
        aim: { quaternion: [0, 0, 0, 0], fov: 60 },
      }).success,
    ).toBe(false);
    expect(roomConstellationDocumentSchema.safeParse({ ...validDoc, name: "x".repeat(201) }).success).toBe(false);
    expect(
      roomConstellationDocumentSchema.safeParse({
        ...validDoc,
        segments: Array.from({ length: 401 }, (_, index) => ({ fromStarId: index + 1, toStarId: index + 2 })),
      }).success,
    ).toBe(false);
  });
});

describe("firestore mapping", () => {
  it("maps valid constellation documents into domain state", () => {
    const mapped = mapConstellationDocument(
      "uid__c-1",
      {
        version: 1,
        ownerUid: "uid-1",
        ownerLabel: "Explorer BBBB",
        clientConstellationId: "c-1",
        name: "Sky Cat",
        story: "A cat in the sky.",
        prompt: "cat",
        source: "sam3",
        segments: [{ fromStarId: 10, toStarId: 11 }],
        aim: { quaternion: [0, 0, 0, 1], fov: 40 },
        createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
      },
      fallbackAim,
    );
    expect(mapped?.sharedId).toBe("uid__c-1");
    expect(mapped?.segments).toHaveLength(1);
    expect(mapped?.createdAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("builds deterministic shared document ids", () => {
    expect(sharedConstellationDocumentId("uid/1", "constellation-9")).toBe("uid_1__constellation-9");
    expect(sharedConstellationDocumentId("uid/1", "constellation-9")).toBe(
      sharedConstellationDocumentId("uid/1", "constellation-9"),
    );
  });
});

describe("aim normalization", () => {
  it("falls back when remote aim is invalid", () => {
    const current = new SkyController().getAim();
    const normalized = normalizeSkyAim({ quaternion: [0, 0, 0, 0], fov: 999 }, current);
    expect(normalized.quaternion).toEqual(current.quaternion);
    expect(normalized.fov).toBeGreaterThanOrEqual(FOV_MIN);
    expect(normalized.fov).toBeLessThanOrEqual(FOV_MAX);
  });

  it("focuses sky aim through SkyController", () => {
    const sky = new SkyController();
    sky.focusAim({ quaternion: [0, 0.1, 0, 0.995], fov: 30 });
    const aim = sky.getAim();
    expect(aim.fov).toBe(30);
    expect(aim.quaternion.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("room reducer purity", () => {
  it("ignores stale listener epochs after leave", () => {
    let state = roomReducer(initialRoomState, {
      type: "room_connected",
      roomCode: "ABCDEF",
      uid: "u1",
      label: "Explorer AAAA",
      listenerEpoch: 1,
    });
    state = roomReducer(state, { type: "room_left" });
    const after = roomReducer(state, {
      type: "room_members",
      members: [{ uid: "other", label: "Explorer BBBB" }],
      listenerEpoch: 1,
    });
    expect(after.members).toHaveLength(0);
  });

  it("resets connection data on leave while keeping join draft", () => {
    let state = roomReducer(initialRoomState, { type: "room_set_join_draft", code: "ABC234" });
    state = roomReducer(state, {
      type: "room_connected",
      roomCode: "ABC234",
      uid: "u1",
      label: "Explorer AAAA",
      listenerEpoch: 2,
    });
    state = roomReducer(state, { type: "room_left" });
    expect(state.status).toBe("disconnected");
    expect(state.roomCode).toBeNull();
    expect(state.joinDraftCode).toBe("ABC234");
  });
});

describe("room errors", () => {
  it("surfaces actionable Firebase configuration and network failures", () => {
    expect(roomErrorMessage("create", { code: "permission-denied" })).toBe(
      "Firebase denied the room request. Deploy the current Firestore rules.",
    );
    expect(roomErrorMessage("create", { code: "auth/operation-not-allowed" })).toBe(
      "Anonymous Firebase sign-in is disabled.",
    );
    expect(roomErrorMessage("join", { code: "unavailable" })).toBe(
      "Firebase is unreachable. Check the network and try again.",
    );
  });

  it("keeps operation-specific fallback messages", () => {
    expect(roomErrorMessage("create", new Error("unknown"))).toBe("Could not create a room. Try again.");
    expect(roomErrorMessage("join", new Error("room_not_found"))).toBe("Room not found.");
    expect(roomErrorMessage("sync", new Error("unknown"))).toBe(
      "Constellation created locally, but room sync failed.",
    );
  });
});

describe("local vs room constellation state", () => {
  it("keeps session storage separate from room constellations", () => {
    const local = {
      id: "c-local",
      prompt: "dog",
      name: "Local",
      story: "Local story",
      segments: [{ fromStarId: 1, toStarId: 2 }],
      source: "sam3" as const,
    };
    let app = appReducer(initialAppState, {
      type: "generation_finished",
      constellation: local,
      generationProbe: null,
      inputPhotoUri: "file:///photo.jpg",
    });
    expect(app.sessionConstellations).toHaveLength(1);

    const remote = mapConstellationDocument(
      "uid__remote",
      {
        version: 1,
        ownerUid: "uid-2",
        ownerLabel: "Explorer CCCC",
        clientConstellationId: "c-remote",
        name: "Remote",
        story: "Remote story",
        prompt: "cat",
        source: "sam3",
        segments: [{ fromStarId: 3, toStarId: 4 }],
        aim: { quaternion: [0, 0, 0, 1], fov: 55 },
        createdAt: null,
        updatedAt: null,
      },
      fallbackAim,
    )!;
    app = appReducer(app, { type: "select_room_constellation", constellation: roomConstellationToCustom(remote) });
    expect(app.sessionConstellations).toHaveLength(1);
    expect(app.sessionConstellations[0]?.constellation.id).toBe("c-local");
    expect(app.constellation?.id).toBe("c-remote");
    expect(app.generationProbe).toBeNull();
    expect(app.inputPhotoUri).toBeNull();
  });

  it("does not remove a local constellation when room publish fails", () => {
    const constellation = {
      id: "c-1",
      prompt: "dog",
      name: "Sky Dog",
      story: "Story",
      segments: [{ fromStarId: 1, toStarId: 2 }],
      source: "sam3" as const,
    };
    const afterGeneration = appReducer(initialAppState, {
      type: "generation_finished",
      constellation,
      generationProbe: null,
      inputPhotoUri: null,
    });
    const room = roomReducer(initialRoomState, {
      type: "room_pending_publish",
      pending: { constellation, aim: fallbackAim },
    });
    expect(afterGeneration.constellation?.id).toBe("c-1");
    expect(room.pendingPublish?.constellation.id).toBe("c-1");
  });
});
