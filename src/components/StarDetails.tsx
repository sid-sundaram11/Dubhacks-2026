import { Pressable, StyleSheet, Text, View } from "react-native";

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
      <View style={styles.header}>
        <Text style={styles.name}>{props.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close star details" onPress={props.onClose} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>
        Magnitude {props.magnitude.toFixed(2)}
        {props.constellation ? ` · ${props.constellation}` : ""}
        {props.designation ? ` · ${props.designation}` : ""}
        {` · HYG ${props.id}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(8, 10, 18, 0.82)",
    borderRadius: 14,
    padding: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { color: "#f7f3ea", fontSize: 18, fontWeight: "700", flex: 1 },
  meta: { color: "#d5dced", marginTop: 4 },
  close: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#f0c27a" },
});
