import { FOV_MAX, FOV_MIN } from "../../domain/constants";
import { clamp } from "../../domain/math";
import type { SkyAim, QuaternionTuple } from "../starfield/skyController";

function finiteQuaternion(value: unknown): QuaternionTuple | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const parts = value.map((part) => (typeof part === "number" && Number.isFinite(part) ? part : NaN));
  if (parts.some((part) => Number.isNaN(part))) return null;
  const [x, y, z, w] = parts as [number, number, number, number];
  const length = Math.hypot(x, y, z, w);
  if (length < 1e-8) return null;
  return [x / length, y / length, z / length, w / length];
}

export function normalizeSkyAim(raw: unknown, fallback: SkyAim): SkyAim {
  if (typeof raw !== "object" || raw === null) return fallback;
  const record = raw as { quaternion?: unknown; fov?: unknown };
  const quaternion = finiteQuaternion(record.quaternion) ?? fallback.quaternion;
  const fovRaw = typeof record.fov === "number" && Number.isFinite(record.fov) ? record.fov : fallback.fov;
  return { quaternion, fov: clamp(fovRaw, FOV_MIN, FOV_MAX) };
}
