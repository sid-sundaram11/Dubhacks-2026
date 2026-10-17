import * as THREE from "three";

const vector = new THREE.Vector3();

export function projectToScreen(
  position: { x: number; y: number; z: number },
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): { x: number; y: number; inFront: boolean; onScreen: boolean } {
  vector.set(position.x, position.y, position.z);
  vector.applyMatrix4(camera.matrixWorldInverse);
  const inFront = vector.z < 0;
  vector.set(position.x, position.y, position.z);
  vector.project(camera);
  const x = (vector.x * 0.5 + 0.5) * width;
  const y = (-vector.y * 0.5 + 0.5) * height;
  const onScreen = inFront && vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1;
  return { x, y, inFront, onScreen };
}
