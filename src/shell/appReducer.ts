import type { ConstellationSegment, CustomConstellation } from "../domain/constellation";
import type { GenerationTrace } from "../domain/generation";
import type { StarId } from "../domain/star";
import { appendSegment, undoSegment } from "../features/constellation/editor";

export interface SavedConstellation {
  constellation: CustomConstellation;
  subjectPng: string | null;
  addedAt: number;
}

export interface AppState {
  prompt: string;
  mode: "explore" | "manual";
  selectedStarId: StarId | null;
  pathStarId: StarId | null;
  constellation: CustomConstellation | null;
  sessionConstellations: SavedConstellation[];
  edited: boolean;
  generationStatus: "idle" | "running" | "needs-zoom";
  generationProbe: GenerationTrace | null;
  inputPhotoUri: string | null;
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
  sessionConstellations: [],
  edited: false,
  generationStatus: "idle",
  generationProbe: null,
  inputPhotoUri: null,
  statusMessage: "Drag to look around the sky. Pinch to zoom.",
  skyLocked: false,
  confirmClear: false,
};

export type AppAction =
  | { type: "set_prompt"; prompt: string }
  | { type: "select_star"; id: StarId; at: number }
  | { type: "clear_selection" }
  | { type: "manual_tap"; id: StarId; at: number }
  | { type: "toggle_manual" }
  | { type: "generation_started" }
  | {
      type: "generation_finished";
      constellation: CustomConstellation;
      generationProbe: GenerationTrace | null;
      inputPhotoUri: string | null;
      at: number;
    }
  | { type: "generation_failed" }
  | { type: "generation_unreachable" }
  | { type: "generation_segmentation_unavailable" }
  | { type: "generation_segmentation_model_unavailable" }
  | { type: "generation_segmentation_out_of_memory" }
  | { type: "generation_no_subject" }
  | { type: "generation_timeout" }
  | { type: "generation_needs_zoom" }
  | { type: "set_status"; message: string }
  | { type: "recall_constellation"; id: string }
  | { type: "undo"; at: number }
  | { type: "request_clear" }
  | { type: "confirm_clear" }
  | { type: "cancel_clear" }
  | { type: "select_room_constellation"; constellation: CustomConstellation };

function remember(
  session: readonly SavedConstellation[],
  constellation: CustomConstellation,
  addedAt: number,
  subjectPng?: string | null,
): SavedConstellation[] {
  const index = session.findIndex((item) => item.constellation.id === constellation.id);
  if (index < 0) return [...session, { constellation, subjectPng: subjectPng ?? null, addedAt }];
  const next = [...session];
  next[index] = {
    constellation,
    subjectPng: subjectPng === undefined ? session[index]!.subjectPng : subjectPng,
    addedAt: session[index]!.addedAt,
  };
  return next;
}

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
      if (state.mode === "manual") return appReducer(state, { type: "manual_tap", id: action.id, at: action.at });
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
      const constellation = manualConstellation(state, segments);
      return {
        ...state,
        selectedStarId: action.id,
        pathStarId: action.id,
        constellation,
        sessionConstellations: remember(state.sessionConstellations, constellation, action.at),
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
        generationProbe: null,
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
        generationProbe: action.generationProbe,
        inputPhotoUri: action.inputPhotoUri,
        sessionConstellations: remember(
          state.sessionConstellations,
          action.constellation,
          action.at,
          action.generationProbe?.stages.found ?? null,
        ),
        statusMessage: action.constellation.name,
      };
    case "generation_failed":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "The subject could not be drawn.",
      };
    case "generation_unreachable":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "The drawing server is not running.",
      };
    case "generation_segmentation_unavailable":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "The segmentation service is not running.",
      };
    case "generation_segmentation_model_unavailable":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "SAM3 could not load. Accept access at Hugging Face, then set HF_TOKEN in services/sam3/.env.",
      };
    case "generation_segmentation_out_of_memory":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "SAM3 ran out of memory. Close GPU-heavy apps, restart SAM3, and try again.",
      };
    case "generation_no_subject":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "SAM3 could not find that subject. Use a specific label and a clearer photo.",
      };
    case "generation_timeout":
      return {
        ...state,
        generationStatus: "idle",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "SAM3 took too long. Keep it running for a warm retry or use a smaller photo.",
      };
    case "recall_constellation": {
      const saved = state.sessionConstellations.find((item) => item.constellation.id === action.id);
      if (!saved) return state;
      return {
        ...state,
        constellation: saved.constellation,
        edited: false,
        pathStarId: null,
        confirmClear: false,
        selectedStarId: null,
        statusMessage: saved.constellation.name,
      };
    }
    case "set_status":
      return { ...state, statusMessage: action.message };
    case "generation_needs_zoom":
      return {
        ...state,
        generationStatus: "needs-zoom",
        skyLocked: false,
        generationProbe: null,
        statusMessage: "Zoom out to include more of the sky.",
      };
    case "undo": {
      if (!state.constellation || state.constellation.segments.length === 0) return state;
      const undone = undoSegment(state.constellation.segments);
      return {
        ...state,
        constellation: { ...state.constellation, segments: undone.segments },
        sessionConstellations: remember(state.sessionConstellations, {
          ...state.constellation,
          segments: undone.segments,
        }, action.at),
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
        generationProbe: null,
        inputPhotoUri: null,
        statusMessage: "Drawing cleared.",
      };
    case "cancel_clear":
      return { ...state, confirmClear: false, statusMessage: state.constellation?.name ?? initialAppState.statusMessage };
    case "select_room_constellation":
      return {
        ...state,
        constellation: action.constellation,
        edited: false,
        pathStarId: null,
        confirmClear: false,
        selectedStarId: null,
        generationProbe: null,
        inputPhotoUri: null,
        statusMessage: action.constellation.name,
      };
    default:
      return state;
  }
}
