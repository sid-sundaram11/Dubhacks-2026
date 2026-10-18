import * as THREE from "three";
import {
  DRAG_RADIANS_PER_PIXEL,
  FOV_MAX,
  FOV_MIN,
  INITIAL_DEC_DEGREES,
  INITIAL_FOV,
  INITIAL_RA_HOURS,
} from "../../domain/constants";
import { clamp } from "../../domain/math";
import { celestialToCartesian } from "../catalog/celestialCoordinates";

export type QuaternionTuple = readonly [number, number, number, number];

export interface SkyAim {
  quaternion: QuaternionTuple;
  fov: number;
}

/**
 * One sky aim, shared by touch, room focus, and calibrated device attitude.
 */
export class SkyController {
  private readonly quaternion = new THREE.Quaternion();
  private readonly initial: THREE.Quaternion;
  private fov = INITIAL_FOV;
  private readonly listeners = new Set<() => void>();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private readonly right = new THREE.Vector3();
  private readonly scratch = new THREE.Quaternion();

  constructor() {
    const target = celestialToCartesian(INITIAL_RA_HOURS, INITIAL_DEC_DEGREES);
    this.initial = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(target.x, target.y, target.z),
    );
    this.quaternion.copy(this.initial);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAim(): SkyAim {
    return {
      quaternion: [this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w],
      fov: this.fov,
    };
  }

  applyToCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.quaternion.copy(this.quaternion);
    camera.fov = this.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  applyDrag(dx: number, dy: number): void {
    this.scratch.setFromAxisAngle(this.worldUp, -dx * DRAG_RADIANS_PER_PIXEL);
    this.quaternion.premultiply(this.scratch);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
    this.scratch.setFromAxisAngle(this.right, -dy * DRAG_RADIANS_PER_PIXEL);
    this.quaternion.premultiply(this.scratch);
    this.quaternion.normalize();
    this.emit();
  }

  /** Fingers moving apart (scale > 1) narrows the field of view. */
  applyPinch(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.fov = clamp(this.fov / scale, FOV_MIN, FOV_MAX);
    this.emit();
  }

  zoomBy(degrees: number): void {
    this.fov = clamp(this.fov + degrees, FOV_MIN, FOV_MAX);
    this.emit();
  }

  setAim(quaternion: QuaternionTuple): void {
    this.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]).normalize();
    this.emit();
  }

  focusAim(aim: SkyAim): void {
    const [x, y, z, w] = aim.quaternion;
    if ([x, y, z, w].every((value) => Number.isFinite(value))) {
      this.quaternion.set(x, y, z, w).normalize();
    }
    if (Number.isFinite(aim.fov)) {
      this.fov = clamp(aim.fov, FOV_MIN, FOV_MAX);
    }
    this.emit();
  }

  reset(): void {
    this.quaternion.copy(this.initial);
    this.fov = INITIAL_FOV;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
