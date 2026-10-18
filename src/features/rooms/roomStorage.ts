import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACTIVE_ROOM_CODE_KEY = "@constellations/activeRoomCode";

export async function readActiveRoomCode(): Promise<string | null> {
  const value = await AsyncStorage.getItem(ACTIVE_ROOM_CODE_KEY);
  return value?.trim() ? value.trim().toUpperCase() : null;
}

export async function writeActiveRoomCode(code: string | null): Promise<void> {
  if (!code) {
    await AsyncStorage.removeItem(ACTIVE_ROOM_CODE_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_ROOM_CODE_KEY, code.toUpperCase());
}
