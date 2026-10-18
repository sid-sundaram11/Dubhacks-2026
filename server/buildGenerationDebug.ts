import type { GeneratedStroke } from "../src/domain/constellation";
import type { Sam3SegmentationMeta } from "./segmentation/contract";
import { graphFromMask } from "./skeleton";

export interface GenerationServerDebug {
  prompt?: string;
  sam3: Sam3SegmentationMeta;
  maskGrid: number[][];
  skeleton: {
    endpoints: number;
    junctions: number;
    fittedStrokeCount: number;
    outputStrokeCount: number;
    outputEdgeCount: number;
  };
  name: string;
  story: string;
  strokes: GeneratedStroke[];
}

export function buildServerGenerationDebug(
  mask: readonly (readonly number[])[],
  sam3: Sam3SegmentationMeta,
  prompt: string | undefined,
  strokes: GeneratedStroke[],
  name: string,
  story: string,
): GenerationServerDebug {
  const graph = graphFromMask(mask);
  const fitted = graph?.strokes ?? [];
  let outputEdgeCount = 0;
  for (const stroke of strokes) outputEdgeCount += Math.max(0, stroke.points.length - 1);
  return {
    prompt: prompt?.trim() || undefined,
    sam3,
    maskGrid: mask.map((row) => [...row]),
    skeleton: {
      endpoints: graph?.endpoints ?? 0,
      junctions: graph?.junctions ?? 0,
      fittedStrokeCount: fitted.length,
      outputStrokeCount: strokes.length,
      outputEdgeCount,
    },
    name,
    story,
    strokes,
  };
}
