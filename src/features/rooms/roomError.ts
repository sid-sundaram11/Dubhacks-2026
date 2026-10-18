export type RoomOperation = "create" | "join" | "sync";

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  return String((error as { code: unknown }).code).toLowerCase();
}

export function roomErrorMessage(operation: RoomOperation, error: unknown): string {
  const code = errorCode(error);

  if (error instanceof Error && error.message === "room_not_found") {
    return "Room not found.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Anonymous Firebase sign-in is disabled.";
  }
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Firebase denied the room request. Deploy the current Firestore rules.";
  }
  if (
    code === "auth/network-request-failed" ||
    code === "unavailable" ||
    code === "firestore/unavailable" ||
    code === "deadline-exceeded" ||
    code === "firestore/deadline-exceeded"
  ) {
    return "Firebase is unreachable. Check the network and try again.";
  }

  if (operation === "create") return "Could not create a room. Try again.";
  if (operation === "join") return "Could not join the room. Check the code and try again.";
  return "Constellation created locally, but room sync failed.";
}
