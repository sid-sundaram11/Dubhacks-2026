import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, serif } from "../theme";

const CHIPS = ["Dragon", "Heart", "Rocket"] as const;

interface GenerationPanelProps {
  prompt: string;
  running: boolean;
  onPromptChange: (prompt: string) => void;
  onGenerate: (prompt: string) => void;
}

export function GenerationPanel({ prompt, running, onPromptChange, onGenerate }: GenerationPanelProps) {
  const disabled = running || prompt.trim().length === 0;
  const submit = (value: string) => {
    if (running || !value.trim()) return;
    onGenerate(value);
  };
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>What do you see in the stars?</Text>
      <View style={styles.composer}>
        <TextInput
          value={prompt}
          onChangeText={onPromptChange}
          editable={!running}
          placeholder="A dragon with raised wings…"
          placeholderTextColor={palette.muted}
          selectionColor={palette.accent}
          maxLength={120}
          accessibilityLabel="Describe your constellation"
          returnKeyType="go"
          onSubmitEditing={() => submit(prompt)}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? "Drawing constellation" : "Generate constellation"}
          accessibilityState={{ disabled, busy: running }}
          disabled={disabled}
          onPress={() => submit(prompt)}
          style={({ pressed }) => [styles.generate, disabled && styles.disabled, pressed && styles.pressed]}
        >
          {running ? <ActivityIndicator color={palette.sky} /> : <Text style={styles.generateText}>↑</Text>}
        </Pressable>
      </View>
      <View style={styles.suggestions}>
        <Text style={styles.try}>Try</Text>
        {CHIPS.map((chip) => (
          <Pressable
            key={chip}
            accessibilityRole="button"
            accessibilityLabel={`Generate ${chip.toLowerCase()} constellation`}
            accessibilityState={{ disabled: running }}
            disabled={running}
            onPress={() => submit(chip)}
            style={({ pressed }) => [styles.chip, running && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  label: { fontFamily: serif, color: palette.text, fontSize: 24 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 6, backgroundColor: palette.raised, borderColor: palette.border, borderWidth: 1, borderRadius: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, paddingVertical: 10, fontFamily: serif, fontSize: 17, color: palette.text },
  generate: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: palette.text },
  generateText: { fontFamily: serif, color: palette.sky, fontSize: 28 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  try: { fontFamily: serif, fontSize: 15, color: palette.muted, marginRight: 4 },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: "center" },
  chipText: { fontFamily: serif, fontSize: 16, color: palette.secondary, textDecorationLine: "underline" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 },
});
