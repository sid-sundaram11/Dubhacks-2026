export type OrbitErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_request"
  | "invalid_star"
  | "conflict"
  | "phase_locked"
  | "auth_unavailable"
  | "payload_too_large";

export class OrbitError extends Error {
  constructor(
    readonly code: OrbitErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}
