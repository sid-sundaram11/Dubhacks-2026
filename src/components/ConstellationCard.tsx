import { StyleSheet, Text, View } from "react-native";
import type { ConstellationSource } from "../domain/constellation";

interface ConstellationCardProps {
  name: string;
  story: string;
  source: ConstellationSource;
  edited: boolean;
}

export function ConstellationCard({ name, story, source, edited }: ConstellationCardProps) {
  const label = edited ? "Edited" : source === "fallback" ? "Offline creation" : source === "manual" ? "Hand drawn" : "Generated";
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.story}>{story}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(8, 10, 18, 0.78)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kicker: { color: "#f0c27a", fontSize: 12, textTransform: "uppercase" },
  name: { color: "#f7f3ea", fontSize: 20, fontWeight: "700" },
  story: { color: "#d5dced", fontSize: 14 },
});
