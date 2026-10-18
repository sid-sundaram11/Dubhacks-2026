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
        <Text style={styles.hint}>Rooms are unavailable right now. Your solo sky is ready to explore.</Text>
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
