export type StarId = number;

export interface CatalogStar {
  id: StarId;
  hip: number | null;
  name: string | null;
  designation: string | null;
  ra: number;
  dec: number;
  magnitude: number;
  colorIndex: number | null;
  constellation: string | null;
}

export interface VisibleStar {
  id: StarId;
  x: number;
  y: number;
  brightness: number;
  magnitude: number;
  isNamed: boolean;
}
