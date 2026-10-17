import { StyleSheet, Text, View } from "react-native";
import type { ConstellationSource } from "../domain/constellation";
import { palette, serif } from "../theme";

interface ConstellationCardProps {
  name: string;
  story: string;
  source: ConstellationSource;
  edited: boolean;
}

export function ConstellationCard({ name, story, source, edited }: ConstellationCardProps) {
  const label = edited ? "YOUR EDITION" : source === "fallback" ? "OFFLINE CREATION" : source === "manual" ? "DRAWN BY YOU" : "YOUR CONSTELLATION";
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{label}</Text>
      <Text selectable style={styles.name}>{name}</Text>
      <Text selectable style={styles.story}>{story}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: palette.border },
  kicker: { fontFamily: serif, color: palette.accent, fontSize: 11, letterSpacing: 2 },
  name: { fontFamily: serif, color: palette.text, fontSize: 28 },
  story: { fontFamily: serif, color: palette.secondary, fontSize: 16, lineHeight: 23 },
});
