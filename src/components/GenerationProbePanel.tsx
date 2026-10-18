import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { GenerationTrace } from "../domain/generation";
import { palette, serif } from "../theme";

interface GenerationProbePanelProps {
  probe: GenerationTrace;
}

export function GenerationProbePanel({ probe }: GenerationProbePanelProps) {
  const traceJson = JSON.stringify(
    {
      server: probe.server ?? null,
      client: probe.client,
      stageImages: "Shown at the bottom of the screen.",
    },
    null,
    2,
  );
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Generation trace</Text>
      <Text style={styles.summary}>
        Snap used {probe.client.candidateCount} sky candidates and drew {probe.client.segments.length} star segments.
        The four process pictures are at the bottom of the screen.
      </Text>
      <ScrollView horizontal nestedScrollEnabled style={styles.jsonScroll}>
        <Text selectable style={styles.json}>{traceJson}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  heading: { fontFamily: serif, color: palette.text, fontSize: 18 },
  summary: { fontFamily: serif, color: palette.secondary, fontSize: 14, lineHeight: 20 },
  jsonScroll: { maxHeight: 180, backgroundColor: palette.raised, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  json: { fontFamily: "Courier", fontSize: 11, color: palette.text, padding: 10 },
});
