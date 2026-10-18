import * as THREE from "three";
import { celestialToCartesian } from "../catalog/celestialCoordinates";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (value: number) => value - Math.floor(value);
const hash = (x: number, y: number, z: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);

function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const smooth = (v: number) => {
    const f = fract(v);
    return f * f * (3 - 2 * f);
  };
  const fx = smooth(x),
    fy = smooth(y),
    fz = smooth(z);
  return mix(
    mix(
      mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  );
}

/** Bake the fixed galactic dust once, rather than evaluating noise at every screen pixel every frame. */
function galacticTexture(): THREE.DataTexture {
  const width = 512,
    height = 256;
  const data = new Uint8Array(width * height * 4);
  const pole = celestialToCartesian(192.85948 / 15, 27.12825);
  const center = celestialToCartesian(266.4051 / 15, -28.936175);
  for (let y = 0; y < height; y += 1) {
    const latitude = ((y + 0.5) / height - 0.5) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const dx = Math.cos(latitude) * Math.cos(longitude);
      const dy = Math.sin(latitude);
      const dz = Math.cos(latitude) * Math.sin(longitude);
      const galacticLatitude = dx * pole.x + dy * pole.y + dz * pole.z;
      const core = Math.pow(
        Math.max(0, dx * center.x + dy * center.y + dz * center.z),
        6,
      );
      const clouds =
        noise(dx * 9, dy * 9, dz * 9) * 0.55 +
        noise(dx * 19, dy * 19, dz * 19) * 0.28 +
        noise(dx * 39, dy * 39, dz * 39) * 0.12 +
        noise(dx * 78, dy * 78, dz * 78) * 0.05;
      const band = Math.exp(
        (-galacticLatitude * galacticLatitude) / (0.009 + core * 0.02),
      );
      const haze = Math.exp((-galacticLatitude * galacticLatitude) / 0.11);
      const riftLatitude =
        galacticLatitude + (noise(dx * 12, dy * 12, dz * 12) - 0.5) * 0.07;
      const rift = Math.exp((-riftLatitude * riftLatitude) / 0.0007);
      const light = band * (0.35 + clouds * 0.65) * (1 - rift * 0.7);
      const offset = (y * width + x) * 4;
      data[offset] = Math.round(
        255 * (0.006 + haze * 0.006 + light * mix(0.055, 0.11, core)),
      );
      data[offset + 1] = Math.round(
        255 * (0.01 + haze * 0.008 + light * mix(0.067, 0.09, core)),
      );
      data[offset + 2] = Math.round(
        255 * (0.021 + haze * 0.016 + light * mix(0.095, 0.082, core)),
      );
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Visual impression of galactic dust aligned to J2000, not a photographic survey. */
export function createSkyAtmosphere() {
  const texture = galacticTexture();
  const geometry = new THREE.SphereGeometry(3, 32, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uSky: { value: texture } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform sampler2D uSky;
      void main() {
        vec3 d = normalize(vDirection);
        vec2 uv = vec2(atan(d.z, d.x) / 6.28318530718 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
        gl_FragColor = texture2D(uSky, uv);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose: () => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
