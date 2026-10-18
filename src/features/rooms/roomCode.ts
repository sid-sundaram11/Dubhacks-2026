import * as Crypto from "expo-crypto";

/** Six-character codes; excludes I, O, 0, and 1. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i += 1) {
    if (!ROOM_CODE_ALPHABET.includes(code[i]!)) return false;
  }
  return true;
}

export async function generateRoomCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(ROOM_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
  }
  return code;
}
