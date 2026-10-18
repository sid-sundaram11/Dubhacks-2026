import { Platform } from "react-native";

export const palette = {
  sky: "#010309",
  surface: "#090e18",
  raised: "#111a27",
  border: "#293033",
  text: "#f3f0e8",
  secondary: "#b0b8bb",
  muted: "#929b9f",
  accent: "#9ecbd0",
};

// DJORE requires a licensed font asset. Didot is the built-in iOS display fallback.
export const serif = Platform.select({
  ios: "Didot",
  android: "serif",
  default: "Didot",
})!;
