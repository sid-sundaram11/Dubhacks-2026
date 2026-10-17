export function displayName(star: {
  id: number;
  hip: number | null;
  name: string | null;
  designation: string | null;
}): string {
  const proper = star.name?.trim();
  if (proper) return proper;
  const designation = star.designation?.trim();
  if (designation) return designation;
  if (star.hip != null) return `HIP ${star.hip}`;
  return `HYG ${star.id}`;
}
