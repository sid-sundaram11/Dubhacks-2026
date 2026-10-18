import type { StarId } from "./star";

export interface StrokePoint {
  x: number;
  y: number;
}

export interface GeneratedStroke {
  points: StrokePoint[];
}

export interface ConstellationSegment {
  fromStarId: StarId;
  toStarId: StarId;
}

export type ConstellationSource = "sam3" | "fallback" | "manual";

export interface CustomConstellation {
  id: string;
  prompt: string;
  name: string;
  story: string;
  segments: ConstellationSegment[];
  source: ConstellationSource;
}
