export interface CopyInput {
  label?: string;
  prompt?: string;
}

const DEFAULT_NAME = "Starlit Subject";
const DEFAULT_STORY = "A quiet shape waits among the fixed stars.";

const PRETTY_NAMES: Record<string, string> = {
  person: "Silent Wanderer",
  object: "Starlit Subject",
};

function article(word: string): string {
  const first = word.trim().charAt(0).toLowerCase();
  return "aeiou".includes(first) ? "an" : "a";
}

function titleCase(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function truncateName(name: string, max = 48): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

function oneSentence(story: string): string {
  const trimmed = story.trim().replace(/[.!?]+$/g, "").trim();
  const single = trimmed.replace(/[.!?]/g, "");
  return `${single}.`;
}

export function nameAndStoryForSegmentation(input?: CopyInput): { name: string; story: string } {
  const raw = (input?.label ?? input?.prompt ?? "").trim().toLowerCase();
  if (!raw) {
    return { name: DEFAULT_NAME, story: DEFAULT_STORY };
  }

  const pretty = PRETTY_NAMES[raw];
  const name = truncateName(pretty ?? titleCase(raw));
  const noun = (pretty ?? titleCase(raw)).toLowerCase();
  const story = oneSentence(`${article(noun)} ${noun} waits among the fixed stars`);
  return { name, story };
}
