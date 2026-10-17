import { Pressable, StyleSheet, Text, View } from "react-native";

interface ActionBarProps {
  canUndo: boolean;
  canClear: boolean;
  manualMode: boolean;
  confirmClear: boolean;
  hasConstellation: boolean;
  onUndo: () => void;
  onToggleManual: () => void;
  onClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onRegenerate: () => void;
  onShare: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

export function ActionBar(props: ActionBarProps) {
  return (
    <View style={styles.row}>
      <Button label="Zoom in" onPress={props.onZoomIn} />
      <Button label="Zoom out" onPress={props.onZoomOut} />
      <Button label="Reset view" onPress={props.onReset} />
      <Button label={props.manualMode ? "Done drawing" : "Draw"} onPress={props.onToggleManual} />
      <Button label="Undo" onPress={props.onUndo} disabled={!props.canUndo} />
      {props.confirmClear ? (
        <>
          <Button label="Confirm clear" onPress={props.onConfirmClear} />
          <Button label="Cancel clear" onPress={props.onCancelClear} />
        </>
      ) : (
        <Button label="Clear" onPress={props.onClear} disabled={!props.canClear} />
      )}
      <Button label="Regenerate" onPress={props.onRegenerate} disabled={!props.hasConstellation} />
      <Button label="Share" onPress={props.onShare} disabled={!props.hasConstellation} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c2436",
  },
  text: { color: "#f4f0e6", fontSize: 14 },
  disabled: { opacity: 0.4 },
});
