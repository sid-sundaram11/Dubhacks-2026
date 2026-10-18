import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useEffect, useRef } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import * as THREE from "three";
import earth from "../../assets/earth-texture.json";
import { patchExpoWebGLForThree } from "../features/starfield/expoGlThree";

export function GlobeMenuButton({
  onPress,
  reducedMotion,
  bottom,
}: {
  onPress: () => void;
  reducedMotion: boolean;
  bottom: number;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;
  useEffect(() => () => cleanup.current?.(), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    cleanup.current?.();
    patchExpoWebGLForThree();
    const canvas = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setAttribute: () => undefined,
      getContext: () => gl,
    };
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas as unknown as HTMLCanvasElement,
      context: gl,
      alpha: true,
    });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10);
    camera.position.z = 3.4;
    const rgba = new Uint8Array(earth.width * earth.height * 4);
    for (let i = 0; i < earth.width * earth.height; i += 1) {
      rgba.set(
        [
          earth.pixels[i * 3]!,
          earth.pixels[i * 3 + 1]!,
          earth.pixels[i * 3 + 2]!,
          255,
        ],
        i * 4,
      );
    }
    const texture = new THREE.DataTexture(
      rgba,
      earth.width,
      earth.height,
      THREE.RGBAFormat,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const geometry = new THREE.SphereGeometry(0.87, 32, 24);
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      shininess: 12,
      specular: 0x214368,
    });
    const globe = new THREE.Mesh(geometry, material);
    globe.rotation.z = 0.18;
    scene.add(globe, new THREE.AmbientLight(0xa4c4ef, 1.5));
    const sunlight = new THREE.DirectionalLight(0xfff5df, 2.7);
    sunlight.position.set(-3, 2, 4);
    scene.add(sunlight);
    let frame = 0;
    let previous = 0;
    let active = AppState.currentState === "active";
    const lifecycle = AppState.addEventListener("change", (state) => {
      active = state === "active";
    });
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (time - previous < 50) return;
      const delta = Math.min((time - previous) / 1000, 0.1);
      previous = time;
      if (!active) return;
      if (!reduced.current) globe.rotation.y += delta * 0.18;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    frame = requestAnimationFrame(render);
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      lifecycle.remove();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  };

  return (
    <View pointerEvents="box-none" style={[styles.position, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open sky menu"
        accessibilityHint="Add a photo, draw, explore rooms, and adjust your sky"
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.65 }]}
      >
        <View pointerEvents="none" style={styles.globe}>
          <GLView style={styles.globe} onContextCreate={onContextCreate} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  button: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(142,189,228,0.24)",
    backgroundColor: "rgba(4,10,19,0.65)",
  },
  globe: { width: 50, height: 50, borderRadius: 25, overflow: "hidden" },
});
