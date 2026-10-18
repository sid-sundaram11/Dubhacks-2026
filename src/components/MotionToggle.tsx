import { Host, Switch } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

export function MotionToggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Host colorScheme="dark" seedColor={palette.accent} style={styles.toggle}>
        <Switch
          value={enabled}
          onValueChange={onChange}
          disabled={disabled}
          label="AR"
          testID="ar-switch"
        />
      </Host>
      <Text style={styles.state}>{enabled ? "ON" : "OFF"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 48,
  },
  state: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: palette.secondary,
    minWidth: 25,
  },
  toggle: { width: 112, height: 44 },
});
