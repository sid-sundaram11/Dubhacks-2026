## src/components/ControlButton.tsx
```tsx
import { Pressable, StyleSheet, Text } from "react-native";
import { palette, serif } from "../theme";

interface ControlButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  symbol?: string;
}

export function ControlButton({ label, onPress, disabled = false, selected = false, symbol }: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, selected && styles.selected, symbol != null && styles.icon, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.text, selected && styles.selectedText, symbol != null && styles.symbol]}>{symbol ?? label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  selected: { backgroundColor: palette.text, borderColor: palette.text },
  icon: { width: 44, paddingHorizontal: 0 },
  text: { fontFamily: serif, color: palette.text, fontSize: 16 },
  selectedText: { color: palette.sky },
  symbol: { fontSize: 24, lineHeight: 26 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
});

```
## src/components/ActionBar.tsx
```tsx
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

```
## src/components/ConstellationCard.tsx
```tsx
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

```
## src/components/RoomPanel.tsx
```tsx
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { normalizeRoomCode, ROOM_CODE_LENGTH } from "../features/rooms/roomCode";
import type { RoomState } from "../features/rooms/roomReducer";
import { palette, serif } from "../theme";

interface RoomPanelProps {
  room: RoomState;
  busy: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onDraftChange: (code: string) => void;
  onClearError: () => void;
  onRetryPublish?: () => void;
}

export function RoomPanel({
  room,
  busy,
  onCreate,
  onJoin,
  onLeave,
  onDraftChange,
  onClearError,
  onRetryPublish,
}: RoomPanelProps) {
  const pending = room.status === "creating" || room.status === "joining" || busy;
  const connected = room.status === "connected" && room.roomCode != null;
  const unconfigured = room.status === "unconfigured";

  if (unconfigured) {
    return (
      <View style={styles.panel} accessibilityLabel="Shared room">
        <Text style={styles.heading}>Shared room</Text>
        <Text style={styles.hint}>Add Firebase config to .env.local to share constellations across devices.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel} accessibilityLabel="Shared room">
      <Text style={styles.heading}>Shared room</Text>
      {connected ? (
        <View style={styles.connected}>
          <View style={styles.row}>
            <Text accessibilityRole="text" style={styles.roomCode}>Room {room.roomCode}</Text>
            <Text style={styles.members}>{room.members.length} member{room.members.length === 1 ? "" : "s"}</Text>
          </View>
          <View style={styles.row}>
            <RoomAction label="Leave" disabled={pending} onPress={onLeave} />
            <Text selectable accessibilityLabel="Room code" style={styles.selectableCode}>{room.roomCode}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.disconnected}>
          <View style={styles.row}>
            <RoomAction label="Create room" disabled={pending} onPress={onCreate} />
            <TextInput
              accessibilityLabel="Room code"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!pending}
              maxLength={ROOM_CODE_LENGTH}
              onChangeText={(value) => onDraftChange(normalizeRoomCode(value))}
              placeholder="ABC234"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={room.joinDraftCode}
            />
            <RoomAction
              label="Join"
              disabled={pending || room.joinDraftCode.length !== ROOM_CODE_LENGTH}
              onPress={() => onJoin(room.joinDraftCode)}
            />
          </View>
        </View>
      )}
      {pending ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {room.status === "creating" ? "Creating room…" : room.status === "joining" ? "Joining room…" : "Working…"}
        </Text>
      ) : null}
      {room.retryableError ? (
        <View style={styles.errorRow}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>{room.retryableError}</Text>
          <Pressable accessibilityRole="button" onPress={onClearError} style={styles.retry}>
            <Text style={styles.retryText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
      {room.pendingPublish && onRetryPublish ? (
        <View style={styles.errorRow}>
          <Text style={styles.error}>Constellation created locally, but room sync failed.</Text>
          <Pressable accessibilityRole="button" onPress={onRetryPublish} style={styles.retry}>
            <Text style={styles.retryText}>Retry sync</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RoomAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.actionDisabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border, paddingTop: 14 },
  heading: { fontFamily: serif, color: palette.muted, fontSize: 12, letterSpacing: 1.2 },
  hint: { fontFamily: serif, color: palette.secondary, fontSize: 14, lineHeight: 20 },
  disconnected: { gap: 8 },
  connected: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  input: {
    flexGrow: 1,
    minWidth: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: serif,
    color: palette.text,
    fontSize: 18,
    letterSpacing: 2,
    backgroundColor: palette.raised,
  },
  roomCode: { fontFamily: serif, color: palette.text, fontSize: 17 },
  members: { fontFamily: serif, color: palette.muted, fontSize: 14 },
  selectableCode: { fontFamily: serif, color: palette.accent, fontSize: 16, letterSpacing: 2 },
  status: { fontFamily: serif, color: palette.accent, fontSize: 14 },
  errorRow: { gap: 6 },
  error: { fontFamily: serif, color: palette.accent, fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: "center" },
  retryText: { fontFamily: serif, color: palette.text, fontSize: 15, textDecorationLine: "underline" },
  action: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
  },
  actionPressed: { opacity: 0.7 },
  actionDisabled: { opacity: 0.35 },
  actionText: { fontFamily: serif, color: palette.text, fontSize: 15 },
});

```
## src/components/StarDetails.tsx
```tsx
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

```
## src/components/GenerationProbePanel.tsx
```tsx
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

```
## src/components/GenerationPanel.tsx
```tsx
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

```
