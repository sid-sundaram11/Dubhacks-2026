import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ORION_FALLBACK_IDS } from "../../src/domain/constants";
import { createOrbitClient, OrbitRequestError, signInAnonymously } from "../../src/features/orbit/orbitClient";
import { HYG_CATALOG_VERSION } from "../../src/features/orbit/orbitSchemas";
import { createOrbitApi, type OrbitApi } from "./api";
import { FALLBACK_COMET_PNG, fetchGrokImaginePng, isPng } from "./comet";
import { catalogHas } from "./catalog";
import {
  demoSnapshot,
  SEED_CYCLE_ID,
  SEED_ORBIT_ID,
  SEED_USER_IDS,
  SEED_WEEK_KEY,
} from "./seed";
import { signJwt } from "./tokens";
import { isoWeekKey, themeForWeek } from "./week";

const SECRET = "test-secret";
const NOW = new Date("2026-10-18T12:00:00.000Z");

function testApi(overrides: Parameters<typeof createOrbitApi>[0] = {}): OrbitApi {
  return createOrbitApi({
    env: {},
    devSecret: SECRET,
    now: () => NOW,
    generateComet: async () => {
      throw new Error("offline");
    },
    ...overrides,
  });
}

function device(api: OrbitApi, token = "") {
  return createOrbitClient({
    baseUrl: "http://orbit.test",
    token,
    fetchImpl: (input, init) => api.handle(new Request(input, init)),
  });
}

async function anonymous(api: OrbitApi) {
  const signed = await signInAnonymously({
    baseUrl: "http://orbit.test",
    fetchImpl: (input, init) => api.handle(new Request(input, init)),
  });
  return signed;
}

function memoryBody(assignmentId: string, story = "A heron stands against the sky.") {
  return {
    assignmentId,
    segments: [{ fromStarId: ORION_FALLBACK_IDS.rigel, toStarId: ORION_FALLBACK_IDS.betelgeuse }],
    name: "Night Heron",
    story,
    catalogVersion: HYG_CATALOG_VERSION,
    description: null,
    caption: null,
  };
}

describe("orbit api", () => {
  it("issues distinct anonymous identities and expires tokens", async () => {
    let now = new Date("2026-10-18T12:00:00.000Z");
    const api = testApi({ now: () => now, tokenTtlSec: 5 });
    const first = await anonymous(api);
    const second = await anonymous(api);
    expect(first.session.userId).not.toBe(second.session.userId);
    expect(first.session.tokenType).toBe("bearer");
    expect(api.repository.snapshot().profiles.map((profile) => profile.id).sort()).toEqual(
      [first.session.userId, second.session.userId].sort(),
    );
    await expect(first.client.currentOrbit()).resolves.toEqual({ orbit: null });
    now = new Date("2026-10-18T12:00:06.000Z");
    await expect(first.client.currentOrbit()).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("proxies Supabase anonymous signup when configured", async () => {
    const supabaseSecret = "supabase-secret";
    const userId = "55555555-5555-4555-8555-555555555555";
    const accessToken = signJwt(userId, supabaseSecret, Math.floor(NOW.getTime() / 1000), 60);
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.supabase.co/auth/v1/signup");
      expect(init?.method).toBe("POST");
      return Response.json({ access_token: accessToken, user: { id: userId } });
    }) as typeof fetch;
    const api = testApi({
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_JWT_SECRET: supabaseSecret },
      fetchImpl,
    });
    const session = await anonymous(api);
    expect(session.session.userId).toBe(userId);
    await expect(session.client.currentOrbit()).resolves.toEqual({ orbit: null });
    const wrong = signJwt(userId, "other-secret", Math.floor(NOW.getTime() / 1000), 60);
    const rejected = await api.handle(
      new Request("http://orbit.test/api/v1/orbits/current", { headers: { authorization: `Bearer ${wrong}` } }),
    );
    expect(rejected.status).toBe(401);
  });

  it("keeps invites inside the orbit and hides every other orbit", async () => {
    const api = testApi();
    const owner = await anonymous(api);
    const guest = await anonymous(api);
    const stranger = await anonymous(api);
    const created = await owner.client.createOrbit("North Window");
    const second = await owner.client.createOrbit("Other Room");
    const invite = await owner.client.invite();
    await guest.client.join(invite.code);
    const guestOrbit = await guest.client.currentOrbit();
    const guestCycle = await guest.client.currentCycle();
    expect(guestOrbit.orbit?.id).toBe(second.orbit.id);
    expect(JSON.stringify(guestOrbit)).not.toContain(created.orbit.id);
    expect(JSON.stringify(guestCycle)).not.toContain(created.orbit.id);
    await expect(guest.client.invite(created.orbit.id)).rejects.toMatchObject({ status: 404, code: "not_found" });
    await expect(stranger.client.join("NOPE")).rejects.toMatchObject({ status: 400 });
    await expect(stranger.client.join("ZZZZZZ")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(guestOrbit.orbit?.members.map((member) => member.userId).sort()).toEqual(
      [owner.session.userId, guest.session.userId].sort(),
    );
  });

  it("enforces membership isolation the same way row level security does", async () => {
    const sql = readFileSync("supabase/migrations/20261018120000_orbits.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("orbit-private");
    expect(sql).toMatch(/public\)\s*values \('orbit-private', 'orbit-private', false\)/);
    expect(sql).not.toMatch(/grant select \(id, cycle_id, slot, answer_key\)/i);
    expect(sql).not.toMatch(/policy\s+\w+\s+on\s+public\.memory_archives\s+for\s+update/i);
    expect(sql).not.toMatch(/policy\s+\w+\s+on\s+public\.threads\s+for\s+select/i);
    expect(sql).toContain("supabase_realtime");
    expect(sql).toContain("public.solve_placements");

    const api = testApi();
    const owner = await anonymous(api);
    const other = await anonymous(api);
    const orbit = await owner.client.createOrbit("Private");
    const cycle = await owner.client.currentCycle();
    const assignmentId = cycle.cycle!.assignments[0]!.id;
    await expect(other.client.finalize(memoryBody(assignmentId))).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(orbit.orbit.members).toEqual([{ userId: owner.session.userId }]);
    const leaked = JSON.stringify(api.repository.currentCycle(other.session.userId));
    expect(leaked).not.toContain(orbit.orbit.id);
  });

  it("rejects unknown HYG ids and keeps a finalized constellation stable", async () => {
    expect(catalogHas(ORION_FALLBACK_IDS.betelgeuse)).toBe(true);
    expect(catalogHas(99_999_999)).toBe(false);
    const api = testApi();
    const owner = await anonymous(api);
    await owner.client.createOrbit("Sky");
    const cycle = await owner.client.currentCycle();
    const assignmentId = cycle.cycle!.assignments[0]!.id;
    await expect(
      owner.client.finalize({
        ...memoryBody(assignmentId),
        segments: [{ fromStarId: 99_999_999, toStarId: ORION_FALLBACK_IDS.rigel }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "invalid_star" });
    expect(api.repository.snapshot().constellations).toHaveLength(0);

    const joiner = await anonymous(api);
    await joiner.client.join((await owner.client.invite()).code);
    const shared = (await owner.client.currentCycle()).cycle!;
    const counts = new Map<string, number>();
    for (const assignment of shared.assignments) counts.set(assignment.assigneeId, (counts.get(assignment.assigneeId) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([4, 5]);
    const mine = shared.assignments.filter((assignment) => assignment.assigneeId === owner.session.userId);

    const saved = await owner.client.finalize({
      ...memoryBody(mine[0]!.id),
      fov: 60,
      aim: [0, 0, 0, 1],
      imageBase64: FALLBACK_COMET_PNG.toString("base64"),
    });
    const replay = await owner.client.finalize({ ...memoryBody(mine[0]!.id), story: "A different story." });
    expect(replay).toEqual({ ...saved, idempotentReplay: true });
    expect(api.repository.snapshot().constellations).toHaveLength(1);
    expect(api.repository.snapshot().constellations[0]?.story).toBe("A heron stands against the sky.");
    expect(api.repository.snapshot().constellations[0]?.imagePath).toMatch(/^orbits\/.+\/constellations\/.+\.png$/);
    const again = await Promise.all([
      owner.client.finalize(memoryBody(mine[1]!.id, "First writing.")),
      owner.client.finalize(memoryBody(mine[1]!.id, "Second writing.")),
    ]);
    expect(again[0]?.constellationId).toBe(again[1]?.constellationId);
    expect(again.filter((item) => item.idempotentReplay)).toHaveLength(1);
    expect(api.repository.snapshot().submissions.filter((item) => item.assignmentId === mine[1]!.id)).toHaveLength(1);
  });

  it("does not return hidden thread answers from the solve API", async () => {
    const api = testApi({ snapshot: demoSnapshot() });
    const client = device(api, api.issueDevToken(SEED_USER_IDS[0]));
    const keys = api.repository.snapshot().threads.map((thread) => thread.answerKey);
    expect(keys).toEqual([`hidden:${SEED_WEEK_KEY}:1`, `hidden:${SEED_WEEK_KEY}:2`, `hidden:${SEED_WEEK_KEY}:3`]);
    const current = await client.currentCycle();
    const ring = await client.checkRing(current.cycle!.id, 0);
    const missed = await client.checkRing(current.cycle!.id, 1);
    expect(ring).toEqual({ correct: true, archived: false });
    expect(missed).toEqual({ correct: false, archived: false });
    const body = JSON.stringify({ current, ring, missed });
    expect(body).not.toContain("answerKey");
    expect(body).not.toContain("threadId");
    for (const key of keys) expect(body).not.toContain(key);
    expect(current.cycle?.assignments.some((assignment) => "threadId" in assignment)).toBe(false);
  });

  it("serializes concurrent placements onto one board", async () => {
    const api = testApi({ snapshot: demoSnapshot() });
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    api.repository.subscribe((event) => seenA.push(event));
    api.repository.subscribe((event) => seenB.push(event));
    const alpha = device(api, api.issueDevToken(SEED_USER_IDS[0]));
    const beta = device(api, api.issueDevToken(SEED_USER_IDS[1]));
    const current = await alpha.currentCycle();
    const open = current.cycle!.memories.filter(
      (memory) => !current.cycle!.board.placements.some((placement) => placement.submissionId === memory.submissionId),
    );
    const [first, second] = await Promise.all([
      alpha.place(open[0]!.submissionId, 1, 0),
      beta.place(open[1]!.submissionId, 1, 1),
    ]);
    expect([first.placements.length, second.placements.length].sort()).toEqual([
      current.cycle!.board.placements.length + 1,
      current.cycle!.board.placements.length + 2,
    ]);
    expect(seenA).toEqual(seenB);
    expect(JSON.stringify(seenA)).not.toContain("hidden:");
    const conflict = await Promise.allSettled([
      alpha.place(open[2]!.submissionId, 2, 0),
      beta.place(open[3]!.submissionId, 2, 0),
    ]);
    expect(conflict.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(conflict.filter((item) => item.status === "rejected")).toHaveLength(1);
    const rejection = conflict.find((item) => item.status === "rejected") as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(OrbitRequestError);
    expect((rejection.reason as OrbitRequestError).code).toBe("conflict");
    const board = (await alpha.currentCycle()).cycle!.board;
    const atSlot = board.placements.filter((placement) => placement.ring === 2 && placement.position === 0);
    expect(atSlot).toHaveLength(1);
  });

  it("caches one weekly comet and falls back when Grok Imagine fails", async () => {
    let calls = 0;
    const phases: string[] = [];
    const custom = Buffer.concat([FALLBACK_COMET_PNG, Buffer.from("orbit")]);
    let api!: OrbitApi;
    api = testApi({
      generateComet: async () => {
        calls += 1;
        return custom;
      },
      onCometStored: (weekKey) => phases.push(...api.repository.phasesForWeek(weekKey)),
    });
    const owner = await anonymous(api);
    await owner.client.createOrbit("Comet");
    await expect(owner.client.revealComet()).rejects.toMatchObject({ code: "phase_locked" });
    const advanced = await owner.client.advancePhase();
    expect(advanced).toEqual({ phase: "comet", cometReady: true });
    expect(phases.every((phase) => phase === "gathering")).toBe(true);
    expect(calls).toBe(1);
    const first = await owner.client.revealComet();
    const second = await owner.client.revealComet();
    expect(first.cached).toBe(true);
    expect(second.cached).toBe(true);
    expect(first.source).toBe("grok-imagine");
    expect(calls).toBe(1);
    expect(second.media[0]?.url).toBe(first.media[0]?.url);
    expect(first.haptics.map((beat) => beat.atMs)).toEqual([0, 280, 640, 1200]);
    const media = await api.handle(new Request(first.media[0]!.url));
    const bytes = Buffer.from(await media.arrayBuffer());
    expect(isPng(bytes)).toBe(true);
    expect(bytes.subarray(-5).toString()).toBe("orbit");

    const other = await anonymous(api);
    await other.client.createOrbit("Second");
    await other.client.advancePhase();
    expect(calls).toBe(1);

    let failures = 0;
    const fallbackApi = testApi({
      generateComet: async () => {
        failures += 1;
        throw new Error("grok down");
      },
    });
    const fallbackOwner = await anonymous(fallbackApi);
    await fallbackOwner.client.createOrbit("Fallback");
    await fallbackOwner.client.advancePhase();
    const revealed = await fallbackOwner.client.revealComet();
    await fallbackOwner.client.revealComet();
    expect(failures).toBe(1);
    expect(revealed.source).toBe("fallback");
    const fallbackMedia = await fallbackApi.handle(new Request(revealed.media[0]!.url));
    expect(Buffer.from(await fallbackMedia.arrayBuffer()).equals(FALLBACK_COMET_PNG)).toBe(true);
  });

  it("reads a Grok Imagine image payload", async () => {
    const png = FALLBACK_COMET_PNG.toString("base64");
    const fetchImpl = (async (input: RequestInfo | URL) => {
      if (String(input) === "https://api.x.ai/v1/images/generations") return Response.json({ data: [{ b64_json: png }] });
      return new Response(FALLBACK_COMET_PNG, { status: 200 });
    }) as typeof fetch;
    const bytes = await fetchGrokImaginePng({
      apiKey: "test",
      model: "grok-2-image",
      prompt: "comet",
      fetchImpl,
    });
    expect(isPng(bytes)).toBe(true);
  });

  it("advances demo phases and seals null descriptions into an immutable chapter", async () => {
    expect(isoWeekKey(new Date("2020-01-01T00:00:00.000Z"))).toBe("2020-W01");
    const api = testApi();
    const owner = await anonymous(api);
    await owner.client.createOrbit("Chapter");
    expect((await owner.client.currentCycle()).cycle?.phase).toBe("gathering");
    const cycle = await owner.client.currentCycle();
    const saved = await owner.client.finalize(memoryBody(cycle.cycle!.assignments[0]!.id));
    expect((await owner.client.advancePhase()).phase).toBe("comet");
    expect((await owner.client.advancePhase()).phase).toBe("solving");
    await owner.client.place(saved.submissionId, 0, 0);
    expect((await owner.client.advancePhase()).phase).toBe("archived");
    await expect(owner.client.advancePhase()).rejects.toMatchObject({ code: "phase_locked" });
    const sealed = await owner.client.currentCycle();
    expect(sealed.chapters.at(-1)?.memories[0]?.description).toBeNull();
    expect(sealed.chapters.at(-1)?.memories[0]?.caption).toBeNull();
    api.repository.updateDescription(saved.constellationId, "leaked");
    const reread = await owner.client.currentCycle();
    expect(reread.cycle?.memories[0]?.description).toBe("leaked");
    expect(reread.chapters.at(-1)?.memories[0]?.description).toBeNull();
    expect(JSON.stringify(reread.chapters)).not.toContain("leaked");
  });

  it("seeds one orbit, one live theme, three threads, nine memories, a board, and an archive", async () => {
    const db = demoSnapshot();
    expect(db.profiles).toHaveLength(4);
    expect(db.orbits).toHaveLength(1);
    expect(db.threads).toHaveLength(3);
    expect(db.submissions).toHaveLength(9);
    expect(db.placements.length).toBeGreaterThan(0);
    expect(db.archives).toHaveLength(1);
    expect(db.archives[0]?.memories.every((memory) => memory.description === null)).toBe(true);
    expect(db.constellations.every((memory) => memory.description === null)).toBe(true);
    expect(db.assignments.every((assignment) => assignment.cycleId === SEED_CYCLE_ID)).toBe(true);
    expect(db.cycles.find((cycle) => cycle.id === SEED_CYCLE_ID)?.themeTitle).toBe(themeForWeek(SEED_WEEK_KEY).title);
    const counts = new Map<string, number>();
    for (const assignment of db.assignments) counts.set(assignment.assigneeId, (counts.get(assignment.assigneeId) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([2, 2, 2, 3]);
    for (const id of [ORION_FALLBACK_IDS.rigel, ORION_FALLBACK_IDS.betelgeuse]) expect(catalogHas(id)).toBe(true);

    const clientSource = readFileSync("src/features/orbit/orbitClient.ts", "utf8");
    expect(clientSource).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(clientSource).not.toContain("XAI_API_KEY");
  });

  it("reloads identical HYG segments for two devices after a restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "orbit-"));
    const storePath = join(directory, "store.json");
    const { writeOrbitSnapshot } = await import("./storeFile");
    writeOrbitSnapshot(storePath, demoSnapshot());
    const open = () =>
      testApi({
        snapshot: undefined,
        storePath,
        persist: true,
      });
    const running = open();
    const alpha = device(running, running.issueDevToken(SEED_USER_IDS[0]));
    const beta = device(running, running.issueDevToken(SEED_USER_IDS[1]));
    const left = await alpha.currentCycle();
    const right = await beta.currentCycle();
    expect(left.cycle?.memories.map((memory) => memory.segments)).toEqual(right.cycle?.memories.map((memory) => memory.segments));
    expect(left.cycle?.memories).toHaveLength(9);
    const openMemories = left.cycle!.memories.filter(
      (memory) => !left.cycle!.board.placements.some((placement) => placement.submissionId === memory.submissionId),
    );
    await alpha.place(openMemories[0]!.submissionId, 1, 0);

    const restarted = open();
    const events: unknown[] = [];
    restarted.repository.subscribe((event) => events.push(event));
    const alphaAgain = device(restarted, restarted.issueDevToken(SEED_USER_IDS[0]));
    const betaAgain = device(restarted, restarted.issueDevToken(SEED_USER_IDS[1]));
    const restored = await alphaAgain.currentCycle();
    const companion = await betaAgain.currentCycle();
    expect(restored.cycle?.orbitId).toBe(SEED_ORBIT_ID);
    expect(restored.cycle?.memories.map((memory) => memory.segments)).toEqual(left.cycle?.memories.map((memory) => memory.segments));
    expect(companion.cycle?.board.placements.some((placement) => placement.submissionId === openMemories[0]!.submissionId)).toBe(true);
    await betaAgain.place(openMemories[1]!.submissionId, 1, 1);
    const shared = await alphaAgain.currentCycle();
    expect(shared.cycle?.board.placements.some((placement) => placement.submissionId === openMemories[1]!.submissionId)).toBe(true);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(shared)).not.toContain("hidden:");
  });
});
