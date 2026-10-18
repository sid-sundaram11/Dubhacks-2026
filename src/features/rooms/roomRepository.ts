import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { CustomConstellation } from "../../domain/constellation";
import type { SkyAim } from "../starfield/skyController";
import { buildConstellationPayload } from "./roomMapper";
import { isValidRoomCode, normalizeRoomCode, generateRoomCode } from "./roomCode";
import { roomConstellationDocumentSchema, roomDocumentSchema } from "./roomSchemas";
import { sharedConstellationDocumentId } from "./sharedDocumentId";

export const ROOM_CONSTELLATION_LIMIT = 50;
const MAX_CREATE_ATTEMPTS = 8;

export interface RoomAuthContext {
  uid: string;
  label: string;
}

export interface RoomRepository {
  createRoom(auth: RoomAuthContext): Promise<string>;
  joinRoom(code: string, auth: RoomAuthContext): Promise<void>;
  publishConstellation(input: {
    roomCode: string;
    auth: RoomAuthContext;
    constellation: CustomConstellation;
    aim: SkyAim;
  }): Promise<void>;
  subscribeMembers(
    roomCode: string,
    onChange: (members: Array<{ id: string; data: unknown }>) => void,
    onError: (message: string) => void,
  ): Unsubscribe;
  subscribeConstellations(
    roomCode: string,
    onChange: (docs: Array<{ id: string; data: unknown }>) => void,
    onError: (message: string) => void,
  ): Unsubscribe;
}

export class FirebaseRoomRepository implements RoomRepository {
  constructor(private readonly firestore: Firestore) {}

  private roomRef(code: string) {
    return doc(this.firestore, "rooms", code);
  }

  async createRoom(auth: RoomAuthContext): Promise<string> {
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const code = await generateRoomCode();
      const roomRef = this.roomRef(code);
      const memberRef = doc(this.firestore, "rooms", code, "members", auth.uid);
      try {
        await runTransaction(this.firestore, async (transaction) => {
          const existing = await transaction.get(roomRef);
          if (existing.exists()) throw new Error("room_exists");
          transaction.set(roomRef, {
            version: 1,
            hostUid: auth.uid,
            createdAt: serverTimestamp(),
          });
          transaction.set(memberRef, {
            version: 1,
            uid: auth.uid,
            label: auth.label,
            joinedAt: serverTimestamp(),
          });
        });
        return code;
      } catch (error) {
        if (error instanceof Error && error.message === "room_exists") continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a room code.");
  }

  async joinRoom(code: string, auth: RoomAuthContext): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) throw new Error("invalid_code");
    const roomRef = this.roomRef(normalized);
    const snapshot = await getDoc(roomRef);
    if (!snapshot.exists()) throw new Error("room_not_found");
    const parsed = roomDocumentSchema.safeParse(snapshot.data());
    if (!parsed.success) throw new Error("room_invalid");
    const memberRef = doc(this.firestore, "rooms", normalized, "members", auth.uid);
    await setDoc(
      memberRef,
      {
        version: 1,
        uid: auth.uid,
        label: auth.label,
        joinedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async publishConstellation(input: {
    roomCode: string;
    auth: RoomAuthContext;
    constellation: CustomConstellation;
    aim: SkyAim;
  }): Promise<void> {
    const normalized = normalizeRoomCode(input.roomCode);
    if (!isValidRoomCode(normalized)) throw new Error("invalid_code");
    const payload = buildConstellationPayload({
      constellation: input.constellation,
      aim: input.aim,
      ownerUid: input.auth.uid,
      ownerLabel: input.auth.label,
    });
    const validated = roomConstellationDocumentSchema.safeParse({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (!validated.success) throw new Error("invalid_constellation");

    const sharedId = sharedConstellationDocumentId(input.auth.uid, input.constellation.id);
    const ref = doc(this.firestore, "rooms", normalized, "constellations", sharedId);
    await setDoc(
      ref,
      {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  subscribeMembers(
    roomCode: string,
    onChange: (members: Array<{ id: string; data: unknown }>) => void,
    onError: (message: string) => void,
  ): Unsubscribe {
    const membersCol = collection(this.firestore, "rooms", roomCode, "members");
    return onSnapshot(
      membersCol,
      (snapshot) => {
        onChange(snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() })));
      },
      () => onError("Could not listen to room members."),
    );
  }

  subscribeConstellations(
    roomCode: string,
    onChange: (docs: Array<{ id: string; data: unknown }>) => void,
    onError: (message: string) => void,
  ): Unsubscribe {
    const constellationsCol = collection(this.firestore, "rooms", roomCode, "constellations");
    const q = query(constellationsCol, orderBy("createdAt", "desc"), limit(ROOM_CONSTELLATION_LIMIT));
    return onSnapshot(
      q,
      (snapshot) => {
        onChange(snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() })));
      },
      () => onError("Could not listen to room constellations."),
    );
  }
}
