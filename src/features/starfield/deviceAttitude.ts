import { Euler, Quaternion, Vector3 } from "three";
import type { QuaternionTuple } from "./skyController";

export interface DeviceRotation {
  alpha: number;
  beta: number;
  gamma: number;
}

/** Expo reports radians. Core Motion uses yaw/pitch/roll; Android uses Z-X-Y. */
export function deviceQuaternion(
  rotation: DeviceRotation,
  orientation: number,
  platform: string,
): Quaternion | null {
  const { alpha, beta, gamma } = rotation;
  if (![alpha, beta, gamma, orientation].every(Number.isFinite)) return null;
  const attitude =
    platform === "ios"
      ? new Quaternion().setFromEuler(new Euler(gamma, beta, alpha, "ZYX"))
      : new Quaternion().setFromEuler(new Euler(beta, gamma, alpha, "ZXY"));
  return attitude
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (-orientation * Math.PI) / 180,
      ),
    )
    .normalize();
}

/** Calibrate once to the existing view; all subsequent movement writes SkyController. */
export class DeviceAimTracker {
  private offset: Quaternion | null = null;

  reset(): void {
    this.offset = null;
  }

  update(device: Quaternion, current: QuaternionTuple): QuaternionTuple {
    if (!this.offset) {
      this.offset = new Quaternion(...current).multiply(
        device.clone().invert(),
      );
    }
    const aim = this.offset.clone().multiply(device).normalize();
    return [aim.x, aim.y, aim.z, aim.w];
  }
}
