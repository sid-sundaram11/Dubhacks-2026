import type { SubjectImage } from "../../src/domain/generation";

export interface Sam3SegmentationMeta {
  maskWidth: number;
  maskHeight: number;
  label?: string;
  confidence?: number;
}

export interface SegmentationResult {
  name: string;
  story: string;
  mask: number[][]; // MASK_SIZE × MASK_SIZE, values 0 | 1
  foundPng: string;
  maskPng: string;
  sam3: Sam3SegmentationMeta;
}

export type SegmentSubject = (image: SubjectImage, prompt?: string) => Promise<SegmentationResult>;
