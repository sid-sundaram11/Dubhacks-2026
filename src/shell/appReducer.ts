import type { ConstellationSegment, CustomConstellation } from "../domain/constellation";
import type { StarId } from "../domain/star";
import { appendSegment, undoSegment } from "../features/constellation/editor";

export interface AppState {
  prompt: string;
  mode: "explore" | "manual";
  selectedStarId: StarId | null;
  pathStarId: StarId | null;
  constellation: CustomConstellation | null;
  edited: boolean;
  generationStatus: "idle" | "running" | "needs-zoom";
  statusMessage: string;
  skyLocked: boolean;
  confirmClear: boolean;
}

export const initialAppState: AppState = {
  prompt: "",
  mode: "explore",
  selectedStarId: null,
  pathStarId: null,
  constellation: null,
  edited: false,
  generationStatus: "idle",
  statusMessage: "Drag to look around the sky. Pinch to zoom.",
  skyLocked: false,
  confirmClear: false,
};

export type AppAction =
  | { type: "set_prompt"; prompt: string }
  | { type: "select_star"; id: StarId }
  | { type: "clear_selection" }
  | { type: "manual_tap"; id: StarId }
  | { type: "toggle_manual" }
  | { type: "generation_started" }
  | { type: "generation_finished"; constellation: CustomConstellation; offline: boolean }
  | { type: "generation_needs_zoom" }
  | { type: "undo" }
  | { type: "request_clear" }
  | { type: "confirm_clear" }
  | { type: "cancel_clear" };

function manualConstellation(state: AppState, segments: ConstellationSegment[]): CustomConstellation {
  if (state.constellation && state.constellation.source !== "manual") {
    return { ...state.constellation, segments };
  }
  if (state.constellation?.source === "manual") {
    return { ...state.constellation, segments };
  }
  return {
    id: `manual-${segments[0]?.fromStarId ?? "sky"}`,
    prompt: state.prompt,
    name: "Hand-drawn Sky",
    story: "Drawn by hand among the fixed stars.",
    segments,
    source: "manual",
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set_prompt":
      return { ...state, prompt: action.prompt };
    case "select_star":
      if (state.mode === "manual") return appReducer(state, { type: "manual_tap", id: action.id });
      return { ...state, selectedStarId: action.id, confirmClear: false };
    case "clear_selection":
      return { ...state, selectedStarId: null };
    case "toggle_manual":
      return {
        ...state,
        mode: state.mode === "manual" ? "explore" : "manual",
        pathStarId: state.mode === "manual" ? null : state.pathStarId,
        confirmClear: false,
        statusMessage: state.mode === "manual" ? "Drag to look around the sky." : "Tap stars to connect them.",
      };
    case "manual_tap": {
      if (state.skyLocked) return state;
      if (state.pathStarId == null || state.pathStarId === action.id) {
        return { ...state, pathStarId: action.id, selectedStarId: action.id, confirmClear: false };
      }
      const current = state.constellation?.segments ?? [];
      const segments = appendSegment(current, state.pathStarId, action.id);
      if (!segments) return { ...state, selectedStarId: action.id };
      const edited = state.constellation != null && state.constellation.source !== "manual";
      return {
        ...state,
        selectedStarId: action.id,
        pathStarId: action.id,
        constellation: manualConstellation(state, segments),
        edited: state.edited || edited,
        confirmClear: false,
        statusMessage: "Segment added.",
      };
    }
    case "generation_started":
      return {
        ...state,
        generationStatus: "running",
        skyLocked: true,
        confirmClear: false,
        statusMessage: "Drawing your constellation.",
      };
    case "generation_finished":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        constellation: action.constellation,
        edited: false,
        pathStarId: null,
        confirmClear: false,
        statusMessage: action.offline ? "Used an offline creation." : action.constellation.name,
      };
    case "generation_needs_zoom":
      return {
        ...state,
        generationStatus: "needs-zoom",
        skyLocked: false,
        statusMessage: "Zoom out to include more of the sky.",
      };
    case "undo": {
      if (!state.constellation || state.constellation.segments.length === 0) return state;
      const undone = undoSegment(state.constellation.segments);
      return {
        ...state,
        constellation: { ...state.constellation, segments: undone.segments },
        pathStarId: undone.pathStarId,
        confirmClear: false,
        statusMessage: "Removed the last segment.",
      };
    }
    case "request_clear":
      if (!state.constellation || state.constellation.segments.length === 0) return state;
      return { ...state, confirmClear: true, statusMessage: "Clear this drawing?" };
    case "confirm_clear":
      return {
        ...state,
        constellation: null,
        edited: false,
        pathStarId: null,
        confirmClear: false,
        statusMessage: "Drawing cleared.",
      };
    case "cancel_clear":
      return { ...state, confirmClear: false, statusMessage: state.constellation?.name ?? initialAppState.statusMessage };
    default:
      return state;
  }
}
