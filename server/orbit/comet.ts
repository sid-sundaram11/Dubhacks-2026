export interface GrokImagineOptions {
  apiKey: string;
  model: string;
  prompt: string;
  fetchImpl: typeof fetch;
}

export const COMET_HAPTICS = [
  { atMs: 0, intensity: "soft" as const, durationMs: 40 },
  { atMs: 280, intensity: "medium" as const, durationMs: 70 },
  { atMs: 640, intensity: "strong" as const, durationMs: 110 },
  { atMs: 1200, intensity: "soft" as const, durationMs: 160 },
];

export function isPng(bytes: Buffer): boolean {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export async function fetchGrokImaginePng(options: GrokImagineOptions): Promise<Buffer> {
  const response = await options.fetchImpl("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!response.ok) throw new Error("grok_imagine_failed");
  const payload = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = payload.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (!first?.url) throw new Error("grok_imagine_failed");
  const image = await options.fetchImpl(first.url);
  if (!image.ok) throw new Error("grok_imagine_failed");
  return Buffer.from(await image.arrayBuffer());
}

export function cometPrompt(weekKey: string): string {
  return `A single luminous comet crossing a dark sky, weekly emblem ${weekKey}, no text`;
}

/** 1×1 PNG used when Grok Imagine is unconfigured or fails. The bytes are stored before reveal. */
export const FALLBACK_COMET_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
