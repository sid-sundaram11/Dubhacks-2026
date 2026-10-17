/** J2000 unit vector. Right ascension is in hours, declination in degrees. Negative Z. */
export function celestialToCartesian(
  rightAscensionHours: number,
  declinationDegrees: number,
): { x: number; y: number; z: number } {
  const ra = (rightAscensionHours * 15 * Math.PI) / 180;
  const dec = (declinationDegrees * Math.PI) / 180;
  const cosDec = Math.cos(dec);
  return {
    x: cosDec * Math.cos(ra),
    y: Math.sin(dec),
    z: -cosDec * Math.sin(ra),
  };
}
