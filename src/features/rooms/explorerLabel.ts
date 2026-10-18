export function explorerLabel(uid: string): string {
  const compact = uid.replace(/-/g, "").toUpperCase();
  const suffix = compact.slice(-4).padStart(4, "0");
  return `Explorer ${suffix}`;
}
