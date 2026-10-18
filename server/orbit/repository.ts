import { randomBytes, randomUUID } from "node:crypto";
import { normalizeSegments } from "../../src/features/constellation/segmentValidation";
import type { FinalizeRequest, OrbitBoard, OrbitCycle, OrbitMemory } from "../../src/features/orbit/orbitSchemas";
import { HYG_CATALOG_VERSION } from "../../src/features/orbit/orbitSchemas";
import { COMET_HAPTICS, FALLBACK_COMET_PNG, isPng } from "./comet";
import { OrbitError } from "./errors";
import {
  type ArchiveRecord,
  type CometRecord,
  type ConstellationRecord,
  type CycleRecord,
  emptyOrbitDb,
  type OrbitDb,
  type OrbitRecord,
} from "./types";
import { ASSIGNMENT_PROMPTS, balancedAssignees, hiddenAnswerKey, isoWeekKey, themeForWeek, threadSlot } from "./week";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface BoardEvent {
  type: "board";
  orbitId: string;
  cycleId: string;
  board: OrbitBoard;
}

export interface OrbitRepositoryOptions {
  now: () => Date;
  catalogHas: (id: number) => boolean;
  generateComet: (weekKey: string) => Promise<Buffer>;
  onChange?: () => void;
  onCometStored?: (weekKey: string) => void;
}

function inviteCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let index = 0; index < 6; index += 1) code += INVITE_ALPHABET[bytes[index]! % INVITE_ALPHABET.length];
  return code;
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class OrbitRepository {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly listeners = new Set<(event: BoardEvent) => void>();

  constructor(
    private db: OrbitDb,
    private readonly options: OrbitRepositoryOptions,
  ) {}

  static create(options: OrbitRepositoryOptions, db: OrbitDb = emptyOrbitDb()): OrbitRepository {
    return new OrbitRepository(db, options);
  }

  snapshot(): OrbitDb {
    return structuredClone(this.db);
  }

  subscribe(listener: (event: BoardEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  phasesForWeek(weekKey: string): string[] {
    return this.db.cycles.filter((cycle) => cycle.weekKey === weekKey).map((cycle) => cycle.phase);
  }

  ensureUser(userId: string): void {
    if (this.db.profiles.some((profile) => profile.id === userId)) return;
    this.db.profiles.push({ id: userId, createdAt: this.iso() });
    this.changed();
  }

  anonymousUser(): string {
    const userId = randomUUID();
    this.ensureUser(userId);
    return userId;
  }

  updateDescription(constellationId: string, description: string | null): void {
    const row = this.db.constellations.find((item) => item.id === constellationId);
    if (!row) throw new OrbitError("not_found", 404);
    row.description = description;
    this.changed();
  }

  createOrbit(userId: string, name: string) {
    this.ensureUser(userId);
    const now = this.iso();
    const orbit: OrbitRecord = { id: randomUUID(), name: name.trim(), createdBy: userId, createdAt: now };
    this.db.orbits.push(orbit);
    this.db.members.push({ orbitId: orbit.id, userId, joinedAt: now });
    this.openCycle(orbit.id, now);
    this.changed();
    return { orbit: this.toPublicOrbit(orbit) };
  }

  invite(userId: string, orbitId?: string): { code: string; orbitId: string } {
    const target = orbitId ?? this.currentMembership(userId)?.orbitId;
    if (!target) throw new OrbitError("not_found", 404);
    this.requireOrbit(userId, target);
    let code = inviteCode();
    for (let attempt = 0; attempt < 5 && this.db.invites.some((invite) => invite.code === code); attempt += 1) {
      code = inviteCode();
    }
    this.db.invites.push({ code, orbitId: target, createdBy: userId, createdAt: this.iso() });
    this.changed();
    return { code, orbitId: target };
  }

  join(userId: string, rawCode: string): { orbitId: string; name: string } {
    this.ensureUser(userId);
    const code = rawCode.trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new OrbitError("invalid_request", 400);
    const invite = this.db.invites.find((item) => item.code === code);
    const orbit = invite ? this.db.orbits.find((item) => item.id === invite.orbitId) : undefined;
    if (!invite || !orbit) throw new OrbitError("not_found", 404);
    const existing = this.db.members.find((member) => member.orbitId === orbit.id && member.userId === userId);
    if (existing) existing.joinedAt = this.iso();
    else {
      this.db.members.push({ orbitId: orbit.id, userId, joinedAt: this.iso() });
      this.rebalance(orbit.id);
    }
    this.changed();
    return { orbitId: orbit.id, name: orbit.name };
  }

  currentOrbit(userId: string) {
    const member = this.currentMembership(userId);
    if (!member) return { orbit: null };
    const orbit = this.db.orbits.find((item) => item.id === member.orbitId);
    if (!orbit) return { orbit: null };
    return { orbit: this.toPublicOrbit(orbit) };
  }

  currentCycle(userId: string) {
    const member = this.currentMembership(userId);
    if (!member) return { cycle: null, chapters: [] as ReturnType<OrbitRepository["toChapter"]>[] };
    this.requireOrbit(userId, member.orbitId);
    const cycle = this.pickCurrent(this.db.cycles.filter((item) => item.orbitId === member.orbitId));
    const chapters = this.db.archives
      .filter((archive) => archive.orbitId === member.orbitId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((archive) => this.toChapter(archive));
    return { cycle: cycle ? this.toPublicCycle(cycle) : null, chapters };
  }

  async finalize(userId: string, input: FinalizeRequest) {
    return this.lock(`assignment:${input.assignmentId}`, () => {
      const assignment = this.db.assignments.find((item) => item.id === input.assignmentId);
      if (!assignment) throw new OrbitError("not_found", 404);
      this.requireOrbit(userId, assignment.orbitId);
      if (assignment.assigneeId !== userId) throw new OrbitError("not_found", 404);
      const existing = this.db.submissions.find((item) => item.assignmentId === assignment.id);
      if (existing) {
        return {
          submissionId: existing.id,
          constellationId: existing.constellationId,
          idempotentReplay: true,
        };
      }
      const cycle = this.db.cycles.find((item) => item.id === assignment.cycleId);
      if (!cycle || cycle.phase !== "gathering") throw new OrbitError("phase_locked", 409);
      if (input.catalogVersion !== HYG_CATALOG_VERSION) throw new OrbitError("invalid_request", 400);
      const segments = normalizeSegments(input.segments);
      if (segments.length === 0) throw new OrbitError("invalid_request", 400);
      for (const segment of segments) {
        if (!this.options.catalogHas(segment.fromStarId) || !this.options.catalogHas(segment.toStarId)) {
          throw new OrbitError("invalid_star", 400);
        }
      }
      const constellationId = randomUUID();
      let imagePath: string | null = null;
      if (input.imageBase64) {
        const bytes = decodePng(input.imageBase64);
        imagePath = `orbits/${assignment.orbitId}/constellations/${constellationId}.png`;
        this.db.media.push({ path: imagePath, bytesBase64: bytes.toString("base64"), contentType: "image/png" });
      }
      const constellation: ConstellationRecord = {
        id: constellationId,
        orbitId: assignment.orbitId,
        ownerId: userId,
        catalogVersion: HYG_CATALOG_VERSION,
        name: input.name.trim(),
        story: input.story.trim(),
        caption: blankToNull(input.caption),
        description: blankToNull(input.description),
        imagePath,
        aim: input.aim ?? null,
        fov: input.fov ?? null,
        segments: segments.map((segment) => ({ fromStarId: segment.fromStarId, toStarId: segment.toStarId })),
        createdAt: this.iso(),
      };
      const submission = {
        id: randomUUID(),
        assignmentId: assignment.id,
        constellationId,
        userId,
        finalizedAt: this.iso(),
      };
      this.db.constellations.push(constellation);
      this.db.submissions.push(submission);
      this.changed();
      return { submissionId: submission.id, constellationId, idempotentReplay: false };
    });
  }

  async place(userId: string, input: { submissionId: string; ring: number; position: number }): Promise<OrbitBoard> {
    const submission = this.db.submissions.find((item) => item.id === input.submissionId);
    const assignment = submission ? this.db.assignments.find((item) => item.id === submission.assignmentId) : undefined;
    if (!submission || !assignment) throw new OrbitError("not_found", 404);
    this.requireOrbit(userId, assignment.orbitId);
    const cycle = this.db.cycles.find((item) => item.id === assignment.cycleId);
    if (!cycle) throw new OrbitError("not_found", 404);
    const board = await this.lock(`cycle:${cycle.id}`, () => {
      if (cycle.phase !== "solving") throw new OrbitError("phase_locked", 409);
      const taken = this.db.placements.some(
        (placement) =>
          placement.cycleId === cycle.id &&
          (placement.submissionId === submission.id ||
            (placement.ring === input.ring && placement.position === input.position)),
      );
      if (taken) throw new OrbitError("conflict", 409);
      this.db.placements.push({
        cycleId: cycle.id,
        orbitId: cycle.orbitId,
        submissionId: submission.id,
        ring: input.ring,
        position: input.position,
        placedBy: userId,
        placedAt: this.iso(),
      });
      cycle.boardVersion += 1;
      this.changed();
      return this.toBoard(cycle);
    });
    this.emit({ type: "board", orbitId: cycle.orbitId, cycleId: cycle.id, board });
    return board;
  }

  async checkRing(userId: string, cycleId: string, ring: number): Promise<{ correct: boolean; archived: boolean }> {
    const cycle = this.db.cycles.find((item) => item.id === cycleId);
    if (!cycle) throw new OrbitError("not_found", 404);
    this.requireOrbit(userId, cycle.orbitId);
    return this.lock(`cycle:${cycle.id}`, () => {
      if (cycle.phase !== "solving" && cycle.phase !== "archived") throw new OrbitError("phase_locked", 409);
      const correct = this.ringCorrect(cycle.id, ring);
      let archived = cycle.phase === "archived";
      if (correct && !archived && [0, 1, 2].every((item) => this.ringCorrect(cycle.id, item))) {
        this.seal(cycle);
        archived = true;
      }
      return { correct, archived };
    });
  }

  async advance(userId: string, orbitId?: string): Promise<{ phase: CycleRecord["phase"]; cometReady: boolean }> {
    const target = orbitId ?? this.currentMembership(userId)?.orbitId;
    if (!target) throw new OrbitError("not_found", 404);
    this.requireOrbit(userId, target);
    return this.lock(`orbit:${target}`, async () => {
      const cycle = this.pickCurrent(this.db.cycles.filter((item) => item.orbitId === target));
      if (!cycle) throw new OrbitError("not_found", 404);
      if (cycle.phase === "gathering") {
        await this.cacheComet(cycle.weekKey);
        cycle.phase = "comet";
        this.changed();
      } else if (cycle.phase === "comet") {
        cycle.phase = "solving";
        this.changed();
      } else if (cycle.phase === "solving") {
        await this.lock(`cycle:${cycle.id}`, () => {
          this.seal(cycle);
        });
      } else {
        throw new OrbitError("phase_locked", 409);
      }
      return { phase: cycle.phase, cometReady: this.db.comets.some((comet) => comet.weekKey === cycle.weekKey) };
    });
  }

  async reveal(userId: string, origin: string, orbitId?: string) {
    const target = orbitId ?? this.currentMembership(userId)?.orbitId;
    if (!target) throw new OrbitError("not_found", 404);
    this.requireOrbit(userId, target);
    const cycle = this.pickCurrent(this.db.cycles.filter((item) => item.orbitId === target));
    if (!cycle) throw new OrbitError("not_found", 404);
    if (cycle.phase === "gathering") throw new OrbitError("phase_locked", 409);
    const cached = await this.cacheComet(cycle.weekKey);
    return {
      weekKey: cached.record.weekKey,
      cached: cached.cached,
      source: cached.record.source,
      path: cached.record.path,
      haptics: cached.record.haptics.map((beat) => ({ ...beat })),
      origin,
    };
  }

  readMedia(path: string): { bytes: Buffer; contentType: string } | null {
    const media = this.db.media.find((item) => item.path === path);
    if (!media) return null;
    return { bytes: Buffer.from(media.bytesBase64, "base64"), contentType: media.contentType };
  }

  private async cacheComet(weekKey: string): Promise<{ record: CometRecord; cached: boolean }> {
    return this.lock(`comet:${weekKey}`, async () => {
      const existing = this.db.comets.find((comet) => comet.weekKey === weekKey);
      if (existing) return { record: existing, cached: true };
      let source: CometRecord["source"] = "grok-imagine";
      let bytes: Buffer;
      try {
        bytes = await this.options.generateComet(weekKey);
        if (!isPng(bytes)) throw new Error("not_png");
      } catch {
        bytes = FALLBACK_COMET_PNG;
        source = "fallback";
      }
      const path = `comet/${weekKey}/comet.png`;
      this.db.media.push({ path, bytesBase64: bytes.toString("base64"), contentType: "image/png" });
      const record: CometRecord = {
        weekKey,
        source,
        path,
        contentType: "image/png",
        haptics: COMET_HAPTICS.map((beat) => ({ ...beat })),
      };
      this.db.comets.push(record);
      this.options.onCometStored?.(weekKey);
      this.changed();
      return { record, cached: false };
    });
  }

  private openCycle(orbitId: string, now: string): CycleRecord {
    const weekKey = isoWeekKey(this.options.now());
    const theme = themeForWeek(weekKey);
    const cycle: CycleRecord = {
      id: randomUUID(),
      orbitId,
      weekKey,
      themeTitle: theme.title,
      themePrompt: theme.prompt,
      phase: "gathering",
      boardVersion: 0,
      createdAt: now,
    };
    this.db.cycles.push(cycle);
    const threads = ([1, 2, 3] as const).map((slot) => {
      const thread = { id: randomUUID(), cycleId: cycle.id, slot, answerKey: hiddenAnswerKey(weekKey, slot) };
      this.db.threads.push(thread);
      return thread;
    });
    const members = this.db.members.filter((member) => member.orbitId === orbitId).map((member) => member.userId);
    const assignees = balancedAssignees(members, ASSIGNMENT_PROMPTS.length);
    ASSIGNMENT_PROMPTS.forEach((prompt, index) => {
      const slot = threadSlot(index);
      const thread = threads.find((item) => item.slot === slot)!;
      this.db.assignments.push({
        id: randomUUID(),
        cycleId: cycle.id,
        orbitId,
        threadId: thread.id,
        assigneeId: assignees[index]!,
        prompt,
        slot: index,
      });
    });
    return cycle;
  }

  private rebalance(orbitId: string): void {
    const cycle = this.pickCurrent(this.db.cycles.filter((item) => item.orbitId === orbitId));
    if (!cycle || cycle.phase !== "gathering") return;
    const assignments = this.db.assignments.filter((item) => item.cycleId === cycle.id).sort((a, b) => a.slot - b.slot);
    if (this.db.submissions.some((submission) => assignments.some((assignment) => assignment.id === submission.assignmentId))) return;
    const members = this.db.members.filter((member) => member.orbitId === orbitId).map((member) => member.userId);
    const assignees = balancedAssignees(members, assignments.length);
    assignments.forEach((assignment, index) => {
      assignment.assigneeId = assignees[index]!;
    });
  }

  private ringCorrect(cycleId: string, ring: number): boolean {
    const thread = this.db.threads.find((item) => item.cycleId === cycleId && item.slot === ring + 1);
    if (!thread) return false;
    const assignmentIds = new Set(this.db.assignments.filter((item) => item.threadId === thread.id).map((item) => item.id));
    const expected = this.db.submissions.filter((item) => assignmentIds.has(item.assignmentId)).map((item) => item.id);
    if (expected.length !== 3) return false;
    const actual = this.db.placements.filter((item) => item.cycleId === cycleId && item.ring === ring).map((item) => item.submissionId);
    if (actual.length !== expected.length) return false;
    const expectedSet = new Set(expected);
    return actual.every((id) => expectedSet.has(id));
  }

  private seal(cycle: CycleRecord): ArchiveRecord {
    const existing = this.db.archives.find((archive) => archive.cycleId === cycle.id);
    if (existing) return existing;
    const archive: ArchiveRecord = {
      id: randomUUID(),
      cycleId: cycle.id,
      orbitId: cycle.orbitId,
      themeTitle: cycle.themeTitle,
      themePrompt: cycle.themePrompt,
      createdAt: this.iso(),
      memories: this.memoriesForCycle(cycle.id).map((memory) => structuredClone(memory)),
    };
    this.db.archives.push(archive);
    cycle.phase = "archived";
    this.changed();
    return archive;
  }

  private memoriesForCycle(cycleId: string): OrbitMemory[] {
    const assignments = this.db.assignments.filter((item) => item.cycleId === cycleId).sort((a, b) => a.slot - b.slot);
    const memories: OrbitMemory[] = [];
    for (const assignment of assignments) {
      const submission = this.db.submissions.find((item) => item.assignmentId === assignment.id);
      if (!submission) continue;
      const constellation = this.db.constellations.find((item) => item.id === submission.constellationId);
      if (!constellation) continue;
      memories.push(this.toMemory(submission.id, constellation));
    }
    return memories;
  }

  private toMemory(submissionId: string, constellation: ConstellationRecord): OrbitMemory {
    return {
      submissionId,
      constellationId: constellation.id,
      catalogVersion: HYG_CATALOG_VERSION,
      name: constellation.name,
      story: constellation.story,
      caption: constellation.caption,
      description: constellation.description,
      imagePath: constellation.imagePath,
      aim: constellation.aim,
      fov: constellation.fov,
      segments: constellation.segments.map((segment) => ({ fromStarId: segment.fromStarId, toStarId: segment.toStarId })),
    };
  }

  private toPublicCycle(cycle: CycleRecord): OrbitCycle {
    return {
      id: cycle.id,
      orbitId: cycle.orbitId,
      weekKey: cycle.weekKey,
      themeTitle: cycle.themeTitle,
      themePrompt: cycle.themePrompt,
      phase: cycle.phase,
      assignments: this.db.assignments
        .filter((item) => item.cycleId === cycle.id)
        .sort((a, b) => a.slot - b.slot)
        .map((item) => ({
          id: item.id,
          prompt: item.prompt,
          assigneeId: item.assigneeId,
          submissionId: this.db.submissions.find((submission) => submission.assignmentId === item.id)?.id ?? null,
        })),
      memories: this.memoriesForCycle(cycle.id),
      board: this.toBoard(cycle),
    };
  }

  private toBoard(cycle: CycleRecord): OrbitBoard {
    return {
      version: cycle.boardVersion,
      placements: this.db.placements
        .filter((item) => item.cycleId === cycle.id)
        .sort((a, b) => a.ring - b.ring || a.position - b.position)
        .map((item) => ({
          submissionId: item.submissionId,
          ring: item.ring,
          position: item.position,
          placedBy: item.placedBy,
        })),
    };
  }

  private toChapter(archive: ArchiveRecord) {
    return {
      id: archive.id,
      cycleId: archive.cycleId,
      orbitId: archive.orbitId,
      themeTitle: archive.themeTitle,
      themePrompt: archive.themePrompt,
      createdAt: archive.createdAt,
      memories: archive.memories.map((memory) => structuredClone(memory)),
    };
  }

  private toPublicOrbit(orbit: OrbitRecord) {
    return {
      id: orbit.id,
      name: orbit.name,
      createdBy: orbit.createdBy,
      members: this.db.members
        .filter((member) => member.orbitId === orbit.id)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId))
        .map((member) => ({ userId: member.userId })),
    };
  }

  private currentMembership(userId: string) {
    return (
      this.db.members
        .filter((member) => member.userId === userId)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.orbitId.localeCompare(b.orbitId))
        .at(-1) ?? null
    );
  }

  private pickCurrent(cycles: CycleRecord[]): CycleRecord | null {
    if (cycles.length === 0) return null;
    const open = cycles.filter((cycle) => cycle.phase !== "archived");
    const pool = open.length > 0 ? open : cycles;
    return [...pool].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).at(-1) ?? null;
  }

  private requireOrbit(userId: string, orbitId: string): OrbitRecord {
    const orbit = this.db.orbits.find((item) => item.id === orbitId);
    const member = this.db.members.some((item) => item.orbitId === orbitId && item.userId === userId);
    if (!orbit || !member) throw new OrbitError("not_found", 404);
    return orbit;
  }

  private emit(event: BoardEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private changed(): void {
    this.options.onChange?.();
  }

  private iso(): string {
    return this.options.now().toISOString();
  }

  private lock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run = previous.then(() => fn());
    this.tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

function decodePng(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) throw new OrbitError("invalid_request", 400);
  const bytes = Buffer.from(value, "base64");
  if (!isPng(bytes)) throw new OrbitError("invalid_request", 400);
  return bytes;
}
