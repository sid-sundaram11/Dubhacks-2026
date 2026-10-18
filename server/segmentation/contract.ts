import type { SubjectImage } from "../../src/domain/generation";

export interface SegmentationResult {
  name: string;
  story: string;
  mask: number[][]; // MASK_SIZE × MASK_SIZE, values 0 | 1
}

export type SegmentSubject = (image: SubjectImage, prompt?: string) => Promise<SegmentationResult>;
