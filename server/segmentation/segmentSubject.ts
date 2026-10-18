import { PNG } from "pngjs";
import type { SubjectImage } from "../../src/domain/generation";
import { maskResponseSchema } from "../../src/features/generation/generationSchemas";
import { Sam3ClientError, segmentWithSam3 } from "../sam3Client";
import type { SegmentSubject } from "./contract";
import { nameAndStoryForSegmentation } from "./copy";
import { cutoutSubjectPng } from "./cutoutSubject";
import { downsampleMaskToGrid, maskGridIsEmpty } from "./downsampleMask";

export class SegmentSubjectError extends Error {
  constructor(
    message: string,
    readonly kind: "unavailable" | "model_unavailable" | "failed",
  ) {
    super(message);
    this.name = "SegmentSubjectError";
  }
}

function decodeMaskPng(base64: string, expectedWidth: number, expectedHeight: number): Uint8Array {
  const buffer = Buffer.from(base64, "base64");
  const png = PNG.sync.read(buffer);
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    throw new SegmentSubjectError("mask_size_mismatch", "failed");
  }
  return png.data;
}

export async function segmentSubject(image: SubjectImage, prompt?: string) {
  let sam;
  try {
    sam = await segmentWithSam3(image, prompt);
  } catch (error) {
    if (error instanceof Sam3ClientError) {
      if (error.code === "model_unavailable") {
        throw new SegmentSubjectError(error.message, "model_unavailable");
      }
      if (error.code === "connection") {
        throw new SegmentSubjectError(error.message, "unavailable");
      }
      throw new SegmentSubjectError(error.message, "failed");
    }
    throw error;
  }

  const pixels = decodeMaskPng(sam.mask, sam.width, sam.height);
  const channels = pixels.length / (sam.width * sam.height);
  const mask = downsampleMaskToGrid(sam.width, sam.height, pixels, channels);
  if (maskGridIsEmpty(mask)) {
    throw new SegmentSubjectError("empty_mask", "failed");
  }

  const { name, story } = nameAndStoryForSegmentation({ label: sam.label, prompt });
  const parsed = maskResponseSchema.safeParse({ name, story, mask });
  if (!parsed.success) {
    throw new SegmentSubjectError("invalid_copy", "failed");
  }

  let foundPng = sam.overlay?.trim() || sam.mask;
  try {
    foundPng = cutoutSubjectPng(image, sam.mask, sam.width, sam.height);
  } catch {
    // Keep the service overlay when the original photo cannot be cut.
  }
  return {
    ...parsed.data,
    foundPng,
    maskPng: sam.mask,
    sam3: {
      maskWidth: sam.width,
      maskHeight: sam.height,
      label: sam.label,
      confidence: sam.confidence,
    },
  };
}

export const defaultSegmentSubject: SegmentSubject = segmentSubject;
