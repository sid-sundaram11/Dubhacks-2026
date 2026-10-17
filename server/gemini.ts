import { GoogleGenAI } from "@google/genai";
import { GENERATION_ATTEMPT_MS } from "../src/domain/constants";
import { drawingResponseJsonSchema } from "../src/features/generation/generationSchemas";

const SYSTEM = [
  "You draw a recognizable silhouette as a few straight strokes on a normalized viewport.",
  "Return JSON with name, story, and strokes.",
  "name is 1-48 characters.",
  "story is exactly one sentence, 1-160 characters, ending with a period.",
  "Use 1 to 4 strokes. Each stroke has 2 to 7 points.",
  "The total number of consecutive edges is 6 to 16.",
  "Every point x and y is between 0 and 1, with a margin of about 0.08 from the edges.",
  "Straight strokes only. No texture, shading, or fill.",
  "Consider the supplied star distribution so strokes pass near bright stars.",
  "Do not return star ids.",
].join(" ");

export async function generateWithGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error("missing_key"), { name: "GenerationError" });
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: drawingResponseJsonSchema,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(GENERATION_ATTEMPT_MS),
    },
  });
  if (!response.text) throw new Error("empty_response");
  return response.text;
}

export function buildModelPrompt(prompt: string, stars: ReadonlyArray<{ x: number; y: number; brightness: number }>): string {
  const lines = stars.map((star, index) => `${index} ${star.x.toFixed(3)} ${star.y.toFixed(3)} ${star.brightness.toFixed(3)}`);
  return `Prompt: ${prompt.trim()}\nStars as index x y brightness, normalized to the current view:\n${lines.join("\n")}`;
}
