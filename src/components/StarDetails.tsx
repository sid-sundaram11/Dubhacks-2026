import { StyleSheet, Text, View } from "react-native";
import { palette, serif } from "../theme";
import { ControlButton } from "./ControlButton";

interface StarDetailsProps {
  name: string;
  magnitude: number;
  constellation: string | null;
  designation: string | null;
  id: number;
  onClose: () => void;
}

export function StarDetails(props: StarDetailsProps) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>SELECTED STAR</Text>
          <Text selectable style={styles.name}>{props.name}</Text>
        </View>
        <ControlButton label="Close star details" symbol="×" onPress={props.onClose} />
      </View>
      <Text selectable style={styles.meta}>
        Magnitude {props.magnitude.toFixed(2)}
        {props.constellation ? `  ·  ${props.constellation}` : ""}
        {props.designation ? `  ·  ${props.designation}` : ""}
        {`  ·  HYG ${props.id}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 16 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleBlock: { flex: 1, gap: 4 },
  kicker: { fontFamily: serif, fontSize: 11, letterSpacing: 2, color: palette.accent },
  name: { fontFamily: serif, color: palette.text, fontSize: 24 },
  meta: { fontFamily: serif, color: palette.secondary, fontSize: 14, lineHeight: 20 },
});
