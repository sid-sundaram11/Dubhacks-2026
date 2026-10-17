import { ORION_FALLBACK_IDS } from "../../domain/constants";
import type { ConstellationSegment, GeneratedStroke } from "../../domain/constellation";

export interface FallbackTemplate {
  name: string;
  story: string;
  strokes: GeneratedStroke[];
}

const dragon: FallbackTemplate = {
  name: "Raised Dragon",
  story: "A dragon lifts its wings across the fixed stars.",
  strokes: [
    { points: [{ x: 0.18, y: 0.72 }, { x: 0.32, y: 0.62 }, { x: 0.48, y: 0.55 }, { x: 0.66, y: 0.48 }, { x: 0.82, y: 0.38 }] },
    { points: [{ x: 0.48, y: 0.55 }, { x: 0.38, y: 0.28 }, { x: 0.58, y: 0.4 }] },
    { points: [{ x: 0.6, y: 0.5 }, { x: 0.72, y: 0.22 }, { x: 0.84, y: 0.36 }] },
  ],
};

const heart: FallbackTemplate = {
  name: "Starlit Heart",
  story: "A heart glows between the brightest nearby stars.",
  strokes: [
    {
      points: [
        { x: 0.5, y: 0.78 },
        { x: 0.22, y: 0.48 },
        { x: 0.28, y: 0.28 },
        { x: 0.5, y: 0.4 },
        { x: 0.72, y: 0.28 },
        { x: 0.78, y: 0.48 },
        { x: 0.5, y: 0.78 },
      ],
    },
  ],
};

const rocket: FallbackTemplate = {
  name: "Night Rocket",
  story: "A rocket climbs through a field of steady stars.",
  strokes: [
    {
      points: [
        { x: 0.5, y: 0.18 },
        { x: 0.42, y: 0.4 },
        { x: 0.42, y: 0.7 },
        { x: 0.5, y: 0.82 },
        { x: 0.58, y: 0.7 },
        { x: 0.58, y: 0.4 },
        { x: 0.5, y: 0.18 },
      ],
    },
    { points: [{ x: 0.42, y: 0.68 }, { x: 0.28, y: 0.84 }, { x: 0.42, y: 0.76 }] },
    { points: [{ x: 0.58, y: 0.68 }, { x: 0.72, y: 0.84 }, { x: 0.58, y: 0.76 }] },
  ],
};

const generic: FallbackTemplate = {
  name: "Four-Point Star",
  story: "A simple star joins the brightest points in view.",
  strokes: [
    { points: [{ x: 0.5, y: 0.18 }, { x: 0.62, y: 0.42 }, { x: 0.82, y: 0.5 }, { x: 0.62, y: 0.58 }, { x: 0.5, y: 0.82 }] },
    { points: [{ x: 0.5, y: 0.82 }, { x: 0.38, y: 0.58 }, { x: 0.18, y: 0.5 }, { x: 0.38, y: 0.42 }, { x: 0.5, y: 0.18 }] },
  ],
};

export function fallbackForPrompt(prompt: string): FallbackTemplate {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("dragon")) return dragon;
  if (normalized.includes("heart")) return heart;
  if (normalized.includes("rocket")) return rocket;
  return generic;
}

const ids = ORION_FALLBACK_IDS;

export const ORION_FALLBACK_SEGMENTS: ConstellationSegment[] = [
  { fromStarId: ids.betelgeuse, toStarId: ids.bellatrix },
  { fromStarId: ids.bellatrix, toStarId: ids.mintaka },
  { fromStarId: ids.mintaka, toStarId: ids.alnilam },
  { fromStarId: ids.alnilam, toStarId: ids.alnitak },
  { fromStarId: ids.alnitak, toStarId: ids.saiph },
  { fromStarId: ids.saiph, toStarId: ids.rigel },
  { fromStarId: ids.rigel, toStarId: ids.betelgeuse },
];

export const ORION_FALLBACK_COPY = {
  name: "Winter Hunter",
  story: "Orion's bright stars hold a shape that is already in the catalog.",
};
