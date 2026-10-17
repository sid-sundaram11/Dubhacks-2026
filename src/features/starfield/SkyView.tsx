import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as THREE from "three";
import type { ConstellationSegment } from "../../domain/constellation";
import type { CatalogStar } from "../../domain/star";
import type { ProjectedStar } from "../constellation/candidateSelection";
import { celestialToCartesian } from "../catalog/celestialCoordinates";
import { layoutText } from "../share/bitmapFont";
import { patchExpoWebGLForThree } from "./expoGlThree";
import { pickStar } from "./picking";
import { projectToScreen } from "./projection";
import { SkyController } from "./skyController";
import { colorFromIndex, magnitudeToBrightness, magnitudeToSize } from "./starAppearance";

export interface ShareCaption {
  name: string;
  story: string;
  attribution: string;
}

export interface SkyViewHandle {
  reset: () => void;
  zoomBy: (degrees: number) => void;
  getProjected: () => ProjectedStar[];
  getSize: () => { width: number; height: number };
  capturePng: (caption: ShareCaption) => Promise<string | null>;
}

interface SkyViewProps {
  stars: readonly CatalogStar[];
  segments: readonly ConstellationSegment[];
  reveal: number;
  selectedStarId: number | null;
  interactionEnabled: boolean;
  onSelectStar: (id: number) => void;
}

interface StarRecord {
  id: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
  brightness: number;
  isNamed: boolean;
}

function pushQuad(
  positions: number[],
  colors: number[],
  corners: ReadonlyArray<readonly [number, number]>,
  color: readonly [number, number, number, number],
) {
  const order = [0, 1, 2, 0, 2, 3];
  for (const index of order) {
    const corner = corners[index]!;
    positions.push(corner[0], corner[1], 0);
    colors.push(color[0], color[1], color[2], color[3]);
  }
}

function pushLine(
  positions: number[],
  colors: number[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: readonly [number, number, number, number],
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  pushQuad(
    positions,
    colors,
    [
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x2 - nx, y2 - ny],
      [x2 + nx, y2 + ny],
    ],
    color,
  );
}

export const SkyView = forwardRef<SkyViewHandle, SkyViewProps>(function SkyView(props, ref) {
  const sky = useRef(new SkyController()).current;
  const starsRef = useRef(props.stars);
  const segmentsRef = useRef(props.segments);
  const revealRef = useRef(props.reveal);
  const selectedRef = useRef(props.selectedStarId);
  const enabledRef = useRef(props.interactionEnabled);
  const onSelectRef = useRef(props.onSelectStar);
  const projectedRef = useRef<ProjectedStar[]>([]);
  const layoutRef = useRef({ width: 1, height: 1 });
  const captionRef = useRef<ShareCaption | null>(null);
  const glViewRef = useRef<GLView>(null);
  const renderFrameRef = useRef<() => void>(() => {});
  const cleanupRef = useRef<(() => void) | null>(null);
  starsRef.current = props.stars;
  segmentsRef.current = props.segments;
  revealRef.current = props.reveal;
  selectedRef.current = props.selectedStarId;
  enabledRef.current = props.interactionEnabled;
  onSelectRef.current = props.onSelectStar;

  useEffect(() => () => cleanupRef.current?.(), []);

  useImperativeHandle(ref, () => ({
    reset: () => sky.reset(),
    zoomBy: (degrees) => sky.zoomBy(degrees),
    getProjected: () => projectedRef.current.map((star) => ({ ...star })),
    getSize: () => ({ ...layoutRef.current }),
    capturePng: async (caption) => {
      captionRef.current = caption;
      renderFrameRef.current();
      const snapshot = await glViewRef.current?.takeSnapshotAsync({ format: "png", compress: 1 });
      captionRef.current = null;
      renderFrameRef.current();
      if (!snapshot) return null;
      return typeof snapshot.uri === "string" ? snapshot.uri : snapshot.localUri;
    },
  }));

  const gesture = useMemo(() => {
    let lastX = 0;
    let lastY = 0;
    let lastScale = 1;
    const pan = Gesture.Pan()
      .minDistance(8)
      .onStart(() => {
        lastX = 0;
        lastY = 0;
      })
      .onUpdate((event) => {
        if (!enabledRef.current) return;
        sky.applyDrag(event.translationX - lastX, event.translationY - lastY);
        lastX = event.translationX;
        lastY = event.translationY;
      });
    const pinch = Gesture.Pinch()
      .onBegin(() => {
        lastScale = 1;
      })
      .onUpdate((event) => {
        if (!enabledRef.current || event.scale <= 0) return;
        sky.applyPinch(event.scale / lastScale);
        lastScale = event.scale;
      });
    const tap = Gesture.Tap()
      .maxDistance(12)
      .maxDuration(350)
      .onEnd((event) => {
        if (!enabledRef.current) return;
        const id = pickStar(projectedRef.current, event.x, event.y);
        if (id != null) onSelectRef.current(id);
      });
    return Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, tap));
  }, [sky]);

  const onLayout = (event: LayoutChangeEvent) => {
    layoutRef.current = {
      width: Math.max(1, event.nativeEvent.layout.width),
      height: Math.max(1, event.nativeEvent.layout.height),
    };
  };

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    patchExpoWebGLForThree();
    const canvas = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      clientWidth: gl.drawingBufferWidth,
      clientHeight: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setAttribute: () => undefined,
      getContext: () => gl,
    };
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas as unknown as HTMLCanvasElement,
      context: gl,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    renderer.setClearColor(0x070814, 1);

    const starScene = new THREE.Scene();
    const overlayScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5);
    const ortho = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10);
    ortho.position.set(0, 0, 1);
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        in float aSize;
        in vec3 aColor;
        out vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        in vec3 vColor;
        out vec4 fragColor;
        void main() {
          vec2 point = gl_PointCoord - vec2(0.5);
          float distance = length(point);
          if (distance > 0.5) discard;
          float alpha = smoothstep(0.5, 0.08, distance);
          fragColor = vec4(vColor, alpha);
        }
      `,
    });
    const points = new THREE.Points(geometry, material);
    starScene.add(points);
    const overlayGeometry = new THREE.BufferGeometry();
    const overlayMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Screen Y grows downward, so this ortho projection flips Y and turns
      // the stroke quads clockwise. Front-face culling would discard them.
      side: THREE.DoubleSide,
      vertexShader: `
        in vec4 aColor;
        out vec4 vColor;
        void main() {
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec4 vColor;
        out vec4 fragColor;
        void main() { fragColor = vColor; }
      `,
    });
    const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    overlay.frustumCulled = false;
    overlayScene.add(overlay);

    let built = -1;
    let records: StarRecord[] = [];
    let frame = 0;

    const ensureStars = () => {
      const stars = starsRef.current;
      if (stars.length === built) return;
      built = stars.length;
      const positions = new Float32Array(stars.length * 3);
      const colors = new Float32Array(stars.length * 3);
      const sizes = new Float32Array(stars.length);
      const { width } = layoutRef.current;
      const pixelRatio = width > 0 ? gl.drawingBufferWidth / width : 1;
      records = stars.map((star, index) => {
        const vector = celestialToCartesian(star.ra, star.dec);
        positions[index * 3] = vector.x;
        positions[index * 3 + 1] = vector.y;
        positions[index * 3 + 2] = vector.z;
        const color = colorFromIndex(star.colorIndex);
        const brightness = magnitudeToBrightness(star.magnitude);
        colors[index * 3] = color[0] * (0.45 + brightness * 0.55);
        colors[index * 3 + 1] = color[1] * (0.45 + brightness * 0.55);
        colors[index * 3 + 2] = color[2] * (0.45 + brightness * 0.55);
        sizes[index] = magnitudeToSize(star.magnitude, pixelRatio, star.name != null);
        return {
          id: star.id,
          x: vector.x,
          y: vector.y,
          z: vector.z,
          magnitude: star.magnitude,
          brightness,
          isNamed: star.name != null,
        };
      });
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    };

    const renderFrame = () => {
      ensureStars();
      const { width, height } = layoutRef.current;
      camera.aspect = width / height;
      sky.applyToCamera(camera);
      ortho.left = 0;
      ortho.right = width;
      ortho.top = 0;
      ortho.bottom = height;
      ortho.updateProjectionMatrix();

      const projected: ProjectedStar[] = records.map((star) => {
        const screen = projectToScreen(star, camera, width, height);
        return {
          id: star.id,
          x: screen.x,
          y: screen.y,
          normalizedX: width > 0 ? screen.x / width : 0,
          normalizedY: height > 0 ? screen.y / height : 0,
          inFront: screen.inFront,
          onScreen: screen.onScreen,
          magnitude: star.magnitude,
          brightness: star.brightness,
          isNamed: star.isNamed,
        };
      });
      projectedRef.current = projected;
      const byId = new Map(projected.map((star) => [star.id, star]));
      const positions: number[] = [];
      const colors: number[] = [];
      const shown = revealRef.current;
      const full = Math.floor(shown);
      segmentsRef.current.forEach((segment, index) => {
        if (index > full) return;
        const amount = index < full ? 1 : shown - full;
        if (amount <= 0) return;
        const from = byId.get(segment.fromStarId);
        const to = byId.get(segment.toStarId);
        if (!from || !to || !from.inFront || !to.inFront || !from.onScreen || !to.onScreen) return;
        const x2 = from.x + (to.x - from.x) * amount;
        const y2 = from.y + (to.y - from.y) * amount;
        pushLine(positions, colors, from.x, from.y, x2, y2, 10, [1, 0.72, 0.35, 0.28]);
        pushLine(positions, colors, from.x, from.y, x2, y2, 2.5, [1, 0.93, 0.75, 0.95]);
      });

      const selected = byId.get(selectedRef.current ?? -1);
      if (selected && selected.onScreen) {
        const steps = 18;
        for (let step = 0; step < steps; step += 1) {
          const a0 = (step / steps) * Math.PI * 2;
          const a1 = ((step + 1) / steps) * Math.PI * 2;
          pushLine(
            positions,
            colors,
            selected.x + Math.cos(a0) * 14,
            selected.y + Math.sin(a0) * 14,
            selected.x + Math.cos(a1) * 14,
            selected.y + Math.sin(a1) * 14,
            2,
            [0.9, 0.95, 1, 0.9],
          );
        }
      }

      const caption = captionRef.current;
      if (caption) {
        pushQuad(positions, colors, [[0, height - 230], [width, height - 230], [width, height], [0, height]], [0.03, 0.04, 0.08, 0.82]);
        const text = `${caption.name}\n${caption.story}\n${caption.attribution}`;
        for (const pixel of layoutText(text, 24, height - 200, 3, width - 48)) {
          pushQuad(
            positions,
            colors,
            [
              [pixel.x, pixel.y],
              [pixel.x + pixel.size, pixel.y],
              [pixel.x + pixel.size, pixel.y + pixel.size],
              [pixel.x, pixel.y + pixel.size],
            ],
            [1, 0.95, 0.86, 1],
          );
        }
      }

      overlayGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      overlayGeometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 4));
      overlay.visible = positions.length > 0;
      renderer.clear(true, true, true);
      renderer.render(starScene, camera);
      renderer.clearDepth();
      renderer.render(overlayScene, ortho);
      gl.endFrameEXP();
    };

    renderFrameRef.current = renderFrame;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      renderFrame();
    };
    loop();
    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      overlayGeometry.dispose();
      overlayMaterial.dispose();
      renderer.dispose();
    };
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <GLView ref={glViewRef} style={{ flex: 1 }} onContextCreate={onContextCreate} />
      </View>
    </GestureDetector>
  );
});
