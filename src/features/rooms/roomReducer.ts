import type { ConstellationSegment, ConstellationSource } from "../../domain/constellation";
import type { CustomConstellation } from "../../domain/constellation";
import type { SkyAim } from "../starfield/skyController";

export type RoomConnectionStatus =
  | "unconfigured"
  | "authenticating"
  | "disconnected"
  | "creating"
  | "joining"
  | "connected"
  | "error";

export interface RoomMember {
  uid: string;
  label: string;
}

export interface RoomConstellation {
  sharedId: string;
  ownerUid: string;
  ownerLabel: string;
  clientConstellationId: string;
  name: string;
  story: string;
  prompt: string;
  source: ConstellationSource;
  segments: ConstellationSegment[];
  aim: SkyAim;
  createdAt: Date | null;
}

export interface PendingPublish {
  constellation: CustomConstellation;
  aim: SkyAim;
}

export interface RoomState {
  status: RoomConnectionStatus;
  roomCode: string | null;
  uid: string | null;
  label: string | null;
  members: RoomMember[];
  constellations: RoomConstellation[];
  pendingPublish: PendingPublish | null;
  retryableError: string | null;
  joinDraftCode: string;
  selectedSharedId: string | null;
  listenerEpoch: number;
}

export const initialRoomState: RoomState = {
  status: "disconnected",
  roomCode: null,
  uid: null,
  label: null,
  members: [],
  constellations: [],
  pendingPublish: null,
  retryableError: null,
  joinDraftCode: "",
  selectedSharedId: null,
  listenerEpoch: 0,
};

export type RoomAction =
  | { type: "room_unconfigured" }
  | { type: "room_authenticating" }
  | { type: "room_disconnected" }
  | { type: "room_set_join_draft"; code: string }
  | { type: "room_creating" }
  | { type: "room_joining"; code: string }
  | {
      type: "room_connected";
      roomCode: string;
      uid: string;
      label: string;
      listenerEpoch: number;
    }
  | { type: "room_members"; members: RoomMember[]; listenerEpoch: number }
  | { type: "room_constellations"; constellations: RoomConstellation[]; listenerEpoch: number }
  | { type: "room_error"; message: string; preserveCode?: boolean }
  | { type: "room_left" }
  | { type: "room_pending_publish"; pending: PendingPublish }
  | { type: "room_clear_pending_publish" }
  | { type: "room_clear_retryable_error" }
  | { type: "room_select_shared"; sharedId: string | null };

function staleEpoch(state: RoomState, epoch: number): boolean {
  return epoch !== state.listenerEpoch;
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "room_unconfigured":
      return { ...initialRoomState, status: "unconfigured" };
    case "room_authenticating":
      return { ...state, status: "authenticating", retryableError: null };
    case "room_disconnected":
      return {
        ...state,
        status: "disconnected",
        roomCode: null,
        members: [],
        constellations: [],
        selectedSharedId: null,
        listenerEpoch: 0,
        retryableError: null,
      };
    case "room_set_join_draft":
      return { ...state, joinDraftCode: action.code };
    case "room_creating":
      return { ...state, status: "creating", retryableError: null };
    case "room_joining":
      return {
        ...state,
        status: "joining",
        joinDraftCode: action.code,
        retryableError: null,
      };
    case "room_connected":
      return {
        ...state,
        status: "connected",
        roomCode: action.roomCode,
        uid: action.uid,
        label: action.label,
        listenerEpoch: action.listenerEpoch,
        retryableError: null,
        joinDraftCode: action.roomCode,
      };
    case "room_members":
      if (staleEpoch(state, action.listenerEpoch)) return state;
      return { ...state, members: action.members };
    case "room_constellations":
      if (staleEpoch(state, action.listenerEpoch)) return state;
      return { ...state, constellations: action.constellations };
    case "room_error":
      return {
        ...state,
        status: "error",
        retryableError: action.message,
        roomCode: null,
        members: [],
        constellations: [],
        selectedSharedId: null,
        listenerEpoch: 0,
        joinDraftCode: action.preserveCode ? state.joinDraftCode : state.joinDraftCode,
      };
    case "room_left":
      return {
        ...initialRoomState,
        status: "disconnected",
        uid: state.uid,
        label: state.label,
        joinDraftCode: state.joinDraftCode,
      };
    case "room_pending_publish":
      return { ...state, pendingPublish: action.pending, retryableError: null };
    case "room_clear_pending_publish":
      return { ...state, pendingPublish: null };
    case "room_clear_retryable_error":
      return { ...state, retryableError: null, status: state.roomCode ? "connected" : "disconnected" };
    case "room_select_shared":
      return { ...state, selectedSharedId: action.sharedId };
    default:
      return state;
  }
}
