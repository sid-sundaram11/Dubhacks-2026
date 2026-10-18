/** Deterministic Firestore document id for idempotent constellation publish. */
export function sharedConstellationDocumentId(ownerUid: string, clientConstellationId: string): string {
  const safeLocal = clientConstellationId
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const safeUid = ownerUid.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  return `${safeUid}__${safeLocal}`;
}
