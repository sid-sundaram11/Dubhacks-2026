import { Platform } from "react-native";

export const palette = {
  sky: "#000000",
  surface: "#0b0d0e",
  raised: "#15191b",
  border: "#293033",
  text: "#f3f0e8",
  secondary: "#b0b8bb",
  muted: "#929b9f",
  accent: "#9ecbd0",
};

// Native rounded faces avoid a font download during the first sky render.
export const rounded = Platform.select({
  ios: "AvenirNextRounded-Regular",
  android: "sans-serif-rounded",
  default: "Arial Rounded MT Bold",
})!;
