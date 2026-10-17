import { GoogleGenAI } from "@google/genai";
import { GENERATION_ATTEMPT_MS } from "../src/domain/constants";
import type { SubjectImage } from "../src/domain/generation";
import { maskResponseJsonSchema } from "../src/features/generation/generationSchemas";

const SYSTEM = [
  "You look at a photo and identify its single main subject.",
  "Return JSON with name, story, and mask.",
  "name is 1-48 characters.",
  "story is exactly one sentence, 1-160 characters, ending with a period.",
  "mask is a 48 by 48 grid of 0 and 1.",
  "1 is the filled silhouette of the subject and 0 is the background.",
  "Include the whole subject, including limbs and thin parts.",
  "Exclude background clutter. One subject only.",
].join(" ");

export async function generateWithGemini(image: SubjectImage): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error("missing_key"), { name: "GenerationError" });
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    contents: {
      role: "user",
      parts: [
        { inlineData: { mimeType: image.mimeType, data: image.data } },
        { text: "Identify the main subject and separate it from the background as a filled silhouette." },
      ],
    },
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: maskResponseJsonSchema,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(GENERATION_ATTEMPT_MS),
    },
  });
  if (!response.text) throw new Error("empty_response");
  return response.text;
}
