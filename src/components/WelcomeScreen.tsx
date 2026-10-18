import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "../features/rooms/roomCode";
import { palette, serif } from "../theme";
import { MotionToggle } from "./MotionToggle";

interface WelcomeScreenProps {
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  onJoin: () => void;
  onSolo: () => void;
  busy: boolean;
  error: string | null;
  motionEnabled: boolean;
  onMotionChange: (enabled: boolean) => void;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const canJoin = props.roomCode.length === ROOM_CODE_LENGTH && !props.busy;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.overlay}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.titleArea}>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.title}
          >
            Constellations
          </Text>
        </View>
        <View style={styles.controls}>
          <View style={styles.roomRow}>
            <TextInput
              accessibilityLabel="Room code, optional"
              value={props.roomCode}
              onChangeText={(value) =>
                props.onRoomCodeChange(normalizeRoomCode(value))
              }
              onSubmitEditing={() => {
                if (canJoin) props.onJoin();
              }}
              placeholder="Room code · optional"
              placeholderTextColor={palette.secondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={ROOM_CODE_LENGTH}
              editable={!props.busy}
              returnKeyType="go"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join room"
              accessibilityState={{ disabled: !canJoin }}
              disabled={!canJoin}
              onPress={props.onJoin}
              style={[styles.join, !canJoin && styles.dim]}
            >
              <Text style={styles.arrow}>{props.busy ? "…" : "↗"}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: props.busy }}
            disabled={props.busy}
            onPress={props.onSolo}
            style={({ pressed }) => [
              styles.solo,
              (pressed || props.busy) && styles.dim,
            ]}
          >
            <Text style={styles.soloText}>Solo</Text>
          </Pressable>
          <MotionToggle
            enabled={props.motionEnabled}
            onChange={props.onMotionChange}
            disabled={props.busy}
          />
          {props.error ? (
            <Text
              selectable
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {props.error}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(1,3,9,0.32)",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  titleArea: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 600,
    minHeight: 190,
  },
  title: {
    fontFamily: serif,
    fontSize: 52,
    letterSpacing: -2,
    color: palette.text,
    textAlign: "center",
  },
  controls: { width: "100%", maxWidth: 300, gap: 26, paddingBottom: 46 },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#637080",
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: palette.text,
    fontFamily: serif,
    fontSize: 17,
    paddingHorizontal: 4,
  },
  join: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  arrow: { color: palette.text, fontSize: 26 },
  solo: {
    minHeight: 56,
    borderRadius: 30,
    backgroundColor: palette.text,
    alignItems: "center",
    justifyContent: "center",
  },
  soloText: {
    color: palette.sky,
    fontFamily: serif,
    fontSize: 23,
    letterSpacing: 1,
  },
  dim: { opacity: 0.4 },
  error: {
    fontSize: 13,
    color: palette.accent,
    textAlign: "center",
    lineHeight: 19,
  },
});
