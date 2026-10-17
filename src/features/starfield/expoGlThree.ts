/**
 * expo-gl WebGL 2 contexts are `instanceof WebGLRenderingContext` (expo/expo#51543).
 * three.js r163+ treats that as WebGL 1 and refuses to render.
 */
let patched = false;

export function patchExpoWebGLForThree(): void {
  if (patched) return;
  patched = true;

  const WebGL2 = globalThis.WebGL2RenderingContext;
  const WebGL1 = globalThis.WebGLRenderingContext;
  if (!WebGL2 || !WebGL1) return;

  const webgl2Proto = WebGL2.prototype;
  if (Object.getPrototypeOf(webgl2Proto) !== WebGL1.prototype) return;

  const shared = Object.create(null) as Record<string | symbol, unknown>;
  const webgl1Proto = WebGL1.prototype;
  for (const key of Object.getOwnPropertyNames(webgl1Proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(webgl1Proto, key);
    if (descriptor) Object.defineProperty(shared, key, descriptor);
  }
  Object.setPrototypeOf(webgl1Proto, shared);
  Object.setPrototypeOf(webgl2Proto, shared);
}
