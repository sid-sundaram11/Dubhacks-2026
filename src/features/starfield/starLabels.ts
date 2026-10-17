export interface LabelStar {
  id: number;
  name: string;
  magnitude: number;
  x: number;
  y: number;
  onScreen: boolean;
}

export interface StarLabel {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Prefer bright named stars; reserve space for the map controls and gesture hint. */
export function placeStarLabels(stars: readonly LabelStar[], width: number, height: number, fontScale = 1): StarLabel[] {
  const labels: StarLabel[] = [];
  const scale = Math.min(Math.max(fontScale, 1), 1.5);
  const candidates = stars.filter((star) => star.onScreen && star.name && star.magnitude <= 2.5)
    .sort((a, b) => a.magnitude - b.magnitude || a.id - b.id);
  for (const star of candidates) {
    const labelWidth = Math.max(48, star.name.length * 8) * scale;
    const labelHeight = 20 * scale;
    const x = star.x + 10 + labelWidth <= width - 12 ? star.x + 10 : star.x - labelWidth - 10;
    const y = star.y - labelHeight / 2;
    if (x < 12 || y < 12 || x + labelWidth > width - 12 || y + labelHeight > height - 40) continue;
    if (height < 190 ? x + labelWidth > width - 180 && y < 76 : x + labelWidth > width - 76 && y < 180) continue;
    if (labels.some((label) => x < label.x + label.width + 10 && x + labelWidth + 10 > label.x && y < label.y + label.height + 6 && y + labelHeight + 6 > label.y)) continue;
    labels.push({ id: star.id, name: star.name, x, y, width: labelWidth, height: labelHeight });
    if (labels.length === 8) break;
  }
  return labels;
}
