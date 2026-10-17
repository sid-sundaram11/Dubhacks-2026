/** Rehearsed sky aim, centered on Betelgeuse so the first tap lands on a named star. */
export const INITIAL_RA_HOURS = 5.919529;
export const INITIAL_DEC_DEGREES = 7.407063;
export const INITIAL_FOV = 60;
export const FOV_MIN = 25;
export const FOV_MAX = 85;
export const PICK_RADIUS_PX = 20;
export const CANDIDATE_CELL_PX = 24;
export const CANDIDATE_MIN = 40;
export const CANDIDATE_MAX = 150;
export const SNAP_RADII = [0.08, 0.14, 0.22] as const;
export const MIN_SEGMENTS = 4;
export const MAX_SEGMENTS = 16;
export const PROMPT_MIN = 1;
export const PROMPT_MAX = 120;
export const SEPARATION_DEGREES = 2;
export const CATALOG_MIN = 4000;
export const CATALOG_MAX = 4500;
export const MAG_LIMIT = 7;
export const ANCHOR_MAG = 3.5;
export const GENERATION_ATTEMPT_MS = 16000;
export const DRAG_RADIANS_PER_PIXEL = 0.005;

export const ORION_FALLBACK_IDS = {
  rigel: 24378,
  bellatrix: 25273,
  mintaka: 25865,
  alnilam: 26246,
  alnitak: 26662,
  saiph: 27298,
  betelgeuse: 27919,
} as const;
