import { useCallback, useEffect, useRef } from "react";
import type { CustomConstellation } from "../../domain/constellation";
import { ensureAnonymousUser, initFirebase } from "../../services/firebase/firebaseConfig";
import type { SkyAim } from "../starfield/skyController";
import { explorerLabel } from "./explorerLabel";
import { mapConstellationDocument, mapMemberDocument } from "./roomMapper";
import { FirebaseRoomRepository, type RoomRepository } from "./roomRepository";
import { readActiveRoomCode, writeActiveRoomCode } from "./roomStorage";
import type { RoomAction, RoomState } from "./roomReducer";
import { INITIAL_FOV } from "../../domain/constants";
const defaultFallbackAim = (): SkyAim => ({
  quaternion: [0, 0, 0, 1],
  fov: INITIAL_FOV,
});

export interface UseRoomOptions {
  roomState: RoomState;
  dispatch: React.Dispatch<RoomAction>;
  repository?: RoomRepository;
  getFallbackAim?: () => SkyAim;
  onPublishFailed?: (message: string) => void;
}

function sortConstellations(
  items: Array<{ sharedId: string; createdAt: Date | null; name: string }>,
): string[] {
  return [...items]
    .sort((a, b) => {
      const at = a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.sharedId);
}

export function useRoom(options: UseRoomOptions) {
  const { roomState, dispatch, onPublishFailed } = options;
  const repositoryRef = useRef<RoomRepository | null>(options.repository ?? null);
  const unsubMembersRef = useRef<(() => void) | null>(null);
  const unsubConstellationsRef = useRef<(() => void) | null>(null);
  const listenerEpochRef = useRef(0);
  const authRef = useRef<{ uid: string; label: string } | null>(null);
  const getFallbackAim = options.getFallbackAim ?? defaultFallbackAim;

  const detachListeners = useCallback(() => {
    unsubMembersRef.current?.();
    unsubMembersRef.current = null;
    unsubConstellationsRef.current?.();
    unsubConstellationsRef.current = null;
  }, []);

  const attachListeners = useCallback(
    (roomCode: string, epoch: number) => {
      detachListeners();
      const repository = repositoryRef.current;
      if (!repository) return;
      unsubMembersRef.current = repository.subscribeMembers(
        roomCode,
        (members) => {
          const mapped = members
            .map((entry) => mapMemberDocument(entry.data, entry.id))
            .filter((member): member is NonNullable<typeof member> => member != null);
          dispatch({ type: "room_members", members: mapped, listenerEpoch: epoch });
        },
        (message) => dispatch({ type: "room_error", message, preserveCode: true }),
      );
      unsubConstellationsRef.current = repository.subscribeConstellations(
        roomCode,
        (docs) => {
          const fallback = getFallbackAim();
          const mapped = docs
            .map((entry) => mapConstellationDocument(entry.id, entry.data, fallback))
            .filter((item): item is NonNullable<typeof item> => item != null);
          const order = sortConstellations(mapped);
          const sorted = order
            .map((id) => mapped.find((item) => item.sharedId === id))
            .filter((item): item is NonNullable<typeof item> => item != null);
          dispatch({ type: "room_constellations", constellations: sorted, listenerEpoch: epoch });
        },
        (message) => dispatch({ type: "room_error", message, preserveCode: true }),
      );
    },
    [detachListeners, dispatch, getFallbackAim],
  );

  const ensureRepository = useCallback(async (): Promise<RoomRepository | null> => {
    if (repositoryRef.current) return repositoryRef.current;
    if (options.repository) {
      repositoryRef.current = options.repository;
      return repositoryRef.current;
    }
    const init = initFirebase();
    if (!init.ok) {
      dispatch({ type: "room_unconfigured" });
      return null;
    }
    repositoryRef.current = new FirebaseRoomRepository(init.firestore);
    return repositoryRef.current;
  }, [dispatch, options.repository]);

  const ensureAuth = useCallback(async () => {
    if (authRef.current) return authRef.current;
    dispatch({ type: "room_authenticating" });
    const session = await ensureAnonymousUser();
    if (!session) {
      dispatch({ type: "room_unconfigured" });
      return null;
    }
    const label = explorerLabel(session.user.uid);
    authRef.current = { uid: session.user.uid, label };
    return authRef.current;
  }, [dispatch]);

  const connectToRoom = useCallback(
    async (code: string) => {
      const repository = await ensureRepository();
      const auth = await ensureAuth();
      if (!repository || !auth) return;
      listenerEpochRef.current += 1;
      const epoch = listenerEpochRef.current;
      dispatch({
        type: "room_connected",
        roomCode: code,
        uid: auth.uid,
        label: auth.label,
        listenerEpoch: epoch,
      });
      await writeActiveRoomCode(code);
      attachListeners(code, epoch);
    },
    [attachListeners, dispatch, ensureAuth, ensureRepository],
  );

  const createRoom = useCallback(async () => {
    dispatch({ type: "room_creating" });
    try {
      const repository = await ensureRepository();
      const auth = await ensureAuth();
      if (!repository || !auth) return;
      const code = await repository.createRoom(auth);
      await connectToRoom(code);
    } catch {
      dispatch({ type: "room_error", message: "Could not create a room. Try again.", preserveCode: true });
    }
  }, [connectToRoom, dispatch, ensureAuth, ensureRepository]);

  const joinRoom = useCallback(
    async (code: string) => {
      dispatch({ type: "room_joining", code });
      try {
        const repository = await ensureRepository();
        const auth = await ensureAuth();
        if (!repository || !auth) return;
        await repository.joinRoom(code, auth);
        const normalized = code.trim().toUpperCase();
        await connectToRoom(normalized);
      } catch (error) {
        const message =
          error instanceof Error && error.message === "room_not_found"
            ? "Room not found."
            : "Could not join the room. Check the code and try again.";
        dispatch({ type: "room_error", message, preserveCode: true });
      }
    },
    [connectToRoom, dispatch, ensureAuth, ensureRepository],
  );

  const leaveRoom = useCallback(async () => {
    detachListeners();
    listenerEpochRef.current += 1;
    await writeActiveRoomCode(null);
    dispatch({ type: "room_left" });
  }, [detachListeners, dispatch]);

  const roomCodeRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  roomCodeRef.current = roomState.roomCode;
  connectedRef.current = roomState.status === "connected";

  const publishConstellation = useCallback(
    async (constellation: CustomConstellation, aim: SkyAim) => {
      const roomCode = roomCodeRef.current;
      if (!connectedRef.current || !roomCode) return;
      const repository = repositoryRef.current ?? (await ensureRepository());
      const auth = authRef.current ?? (await ensureAuth());
      if (!repository || !auth) return;
      dispatch({ type: "room_pending_publish", pending: { constellation, aim } });
      try {
        await repository.publishConstellation({
          roomCode,
          auth,
          constellation,
          aim,
        });
        dispatch({ type: "room_clear_pending_publish" });
      } catch {
        dispatch({ type: "room_pending_publish", pending: { constellation, aim } });
        onPublishFailed?.("Constellation created locally, but room sync failed.");
      }
    },
    [ensureAuth, ensureRepository, onPublishFailed, dispatch],
  );

  const retryPublish = useCallback(async () => {
    if (!roomState.pendingPublish) return;
    await publishConstellation(roomState.pendingPublish.constellation, roomState.pendingPublish.aim);
  }, [publishConstellation, roomState.pendingPublish]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const init = initFirebase();
      if (!init.ok) {
        if (!cancelled) dispatch({ type: "room_unconfigured" });
        return;
      }
      if (!cancelled) dispatch({ type: "room_disconnected" });
      const saved = await readActiveRoomCode();
      if (!saved || cancelled) return;
      await joinRoom(saved);
    })();
    return () => {
      cancelled = true;
      detachListeners();
    };
  }, []);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    publishConstellation,
    retryPublish,
    setJoinDraft: (code: string) => dispatch({ type: "room_set_join_draft", code }),
    clearRoomError: () => dispatch({ type: "room_clear_retryable_error" }),
    selectShared: (sharedId: string | null) => dispatch({ type: "room_select_shared", sharedId }),
  };
}
