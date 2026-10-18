export const ASSIGNMENT_PROMPTS = [
  "A doorway you still picture",
  "The sound of someone arriving",
  "An object that outlived the afternoon",
  "A joke that only your orbit understands",
  "Weather you stood in together",
  "The meal that took too long",
  "A name you almost forgot",
  "Light on a wall at the wrong hour",
  "The last thing you carried home",
] as const;

const THEMES = [
  { title: "A light left on", prompt: "Something you kept because of who shared it." },
  { title: "The long way home", prompt: "A route that only makes sense to your orbit." },
  { title: "What we whispered", prompt: "A sentence you were not ready to say out loud." },
  { title: "Saturday kitchen", prompt: "A small ritual that belongs to all of you." },
] as const;

export function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function themeForWeek(weekKey: string): { title: string; prompt: string } {
  let hash = 0;
  for (const char of weekKey) hash = (hash + char.charCodeAt(0)) % THEMES.length;
  return THEMES[hash]!;
}

export function balancedAssignees(userIds: readonly string[], count: number): string[] {
  const sorted = [...userIds].sort();
  if (sorted.length === 0) throw new Error("orbit has no members");
  return Array.from({ length: count }, (_, index) => sorted[index % sorted.length]!);
}

export function threadSlot(index: number): 1 | 2 | 3 {
  return ((index % 3) + 1) as 1 | 2 | 3;
}

export function hiddenAnswerKey(weekKey: string, slot: number): string {
  return `hidden:${weekKey}:${slot}`;
}
