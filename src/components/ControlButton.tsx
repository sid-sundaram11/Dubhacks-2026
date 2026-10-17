import { Pressable, StyleSheet, Text } from "react-native";
import { palette, serif } from "../theme";

interface ControlButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  symbol?: string;
}

export function ControlButton({ label, onPress, disabled = false, selected = false, symbol }: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, selected && styles.selected, symbol != null && styles.icon, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.text, selected && styles.selectedText, symbol != null && styles.symbol]}>{symbol ?? label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  selected: { backgroundColor: palette.text, borderColor: palette.text },
  icon: { width: 44, paddingHorizontal: 0 },
  text: { fontFamily: serif, color: palette.text, fontSize: 16 },
  selectedText: { color: palette.sky },
  symbol: { fontSize: 24, lineHeight: 26 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
});
