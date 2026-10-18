import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PROMPT_MAX } from "../domain/constants";
import { palette, serif } from "../theme";

interface GenerationPanelProps {
  imageUri: string | null;
  subjectPrompt: string;
  running: boolean;
  onSubjectPromptChange: (value: string) => void;
  onPick: () => void;
  onGenerate: () => void;
}

export function GenerationPanel({
  imageUri,
  subjectPrompt,
  running,
  onSubjectPromptChange,
  onPick,
  onGenerate,
}: GenerationPanelProps) {
  const disabled = running || imageUri == null;
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Choose a photo of the subject</Text>
      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={imageUri ? "Replace photo" : "Choose a photo"}
          accessibilityState={{ disabled: running }}
          disabled={running}
          onPress={onPick}
          style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} accessibilityIgnoresInvertColors />
          ) : (
            <Text style={styles.pickText}>Photo library</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? "Drawing constellation" : "Generate constellation"}
          accessibilityState={{ disabled, busy: running }}
          disabled={disabled}
          onPress={onGenerate}
          style={({ pressed }) => [styles.generate, disabled && styles.disabled, pressed && styles.pressed]}
        >
          {running ? <ActivityIndicator color={palette.sky} /> : <Text style={styles.generateText}>↑</Text>}
        </Pressable>
      </View>
      <Text style={styles.promptLabel}>Subject in the photo</Text>
      <TextInput
        accessibilityLabel="Subject in the photo"
        editable={!running}
        maxLength={PROMPT_MAX}
        onChangeText={onSubjectPromptChange}
        placeholder="dog"
        placeholderTextColor={palette.muted}
        style={styles.promptInput}
        value={subjectPrompt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  label: { fontFamily: serif, color: palette.text, fontSize: 24 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 6, backgroundColor: palette.raised, borderColor: palette.border, borderWidth: 1, borderRadius: 8 },
  pick: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, justifyContent: "center" },
  pickText: { fontFamily: serif, fontSize: 17, color: palette.secondary, textDecorationLine: "underline" },
  thumbnail: { width: 48, height: 48, borderRadius: 4, backgroundColor: palette.sky },
  generate: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: palette.text },
  generateText: { fontFamily: serif, color: palette.sky, fontSize: 28 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 },
  promptLabel: { fontFamily: serif, color: palette.secondary, fontSize: 15 },
  promptInput: {
    fontFamily: serif,
    fontSize: 17,
    color: palette.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.raised,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 8,
  },
});
