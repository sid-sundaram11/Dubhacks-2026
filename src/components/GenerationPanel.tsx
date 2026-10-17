import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const CHIPS = ["Dragon", "Heart", "Rocket"] as const;

interface GenerationPanelProps {
  prompt: string;
  running: boolean;
  onPromptChange: (prompt: string) => void;
  onGenerate: (prompt: string) => void;
}

export function GenerationPanel({ prompt, running, onPromptChange, onGenerate }: GenerationPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Describe a shape</Text>
      <TextInput
        value={prompt}
        onChangeText={onPromptChange}
        placeholder="a dragon with raised wings"
        placeholderTextColor="#8d97ad"
        maxLength={120}
        accessibilityLabel="Constellation prompt"
        style={styles.input}
      />
      <View style={styles.row}>
        {CHIPS.map((chip) => (
          <Pressable
            key={chip}
            accessibilityRole="button"
            accessibilityLabel={`${chip} prompt`}
            onPress={() => onGenerate(chip)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Generate constellation"
          disabled={running || prompt.trim().length === 0}
          onPress={() => onGenerate(prompt)}
          style={[styles.generate, (running || prompt.trim().length === 0) && styles.disabled]}
        >
          <Text style={styles.generateText}>{running ? "Drawing" : "Generate"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  label: { color: "#d5dced", fontSize: 13 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: "#f4f0e6",
    backgroundColor: "#171c2b",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#243049",
  },
  chipText: { color: "#f4f0e6", fontSize: 15 },
  generate: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0c27a",
  },
  generateText: { color: "#1b1408", fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
