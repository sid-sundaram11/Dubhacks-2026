import { StyleSheet, Text, View } from "react-native";
import { palette, serif } from "../theme";
import { ControlButton } from "./ControlButton";

interface ActionBarProps {
  canUndo: boolean;
  canClear: boolean;
  manualMode: boolean;
  confirmClear: boolean;
  hasConstellation: boolean;
  disabled: boolean;
  onUndo: () => void;
  onToggleManual: () => void;
  onClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onRegenerate: () => void;
  onShare: () => void;
}

export function ActionBar(props: ActionBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ControlButton label={props.manualMode ? "Done drawing" : "Draw by hand"} selected={props.manualMode} onPress={props.onToggleManual} disabled={props.disabled} />
        {props.hasConstellation || props.manualMode ? <ControlButton label="Undo" onPress={props.onUndo} disabled={props.disabled || !props.canUndo} /> : null}
        {props.hasConstellation ? <ControlButton label="Clear" onPress={props.onClear} disabled={props.disabled || !props.canClear} /> : null}
        {props.hasConstellation ? <ControlButton label="Regenerate" onPress={props.onRegenerate} disabled={props.disabled} /> : null}
        {props.hasConstellation ? <ControlButton label="Share" onPress={props.onShare} disabled={props.disabled} /> : null}
      </View>
      {props.confirmClear ? (
        <View accessibilityViewIsModal style={styles.confirmation}>
          <Text style={styles.message}>Clear this constellation?</Text>
          <View style={styles.row}>
            <ControlButton label="Keep drawing" onPress={props.onCancelClear} />
            <ControlButton label="Clear drawing" onPress={props.onConfirmClear} selected />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  confirmation: { gap: 10, borderTopWidth: 1, borderColor: palette.border, paddingTop: 12 },
  message: { fontFamily: serif, fontSize: 17, color: palette.text },
});
