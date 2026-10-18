# Theme
Black sky, warm white text, muted cyan accents. Serif display type. 44pt controls, 8pt corners. React Native StyleSheet; no CSS/Tailwind.
## src/theme.ts
```tsx
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

// Times New Roman is built into iOS. Android uses its native serif fallback.
export const serif = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "Times New Roman",
})!;

```
