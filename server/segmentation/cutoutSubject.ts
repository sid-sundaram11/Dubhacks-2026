import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import type { SubjectImage } from "../../src/domain/generation";

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

function decodeSubject(image: SubjectImage): RgbaImage {
  const bytes = Buffer.from(image.data, "base64");
  if (image.mimeType === "image/png") {
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height, data: png.data };
  }
  const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: jpeg.width, height: jpeg.height, data: jpeg.data };
}

function maskOn(mask: Uint8Array, channels: number, index: number): boolean {
  const value = mask[index * channels] ?? 0;
  return value >= 127;
}

/** Cut a duplicate of the photo with the segmentation mask so subject pixels stay unchanged. */
export function cutoutSubjectPng(image: SubjectImage, maskPngBase64: string, maskWidth: number, maskHeight: number): string {
  const photo = decodeSubject(image);
  const maskPng = PNG.sync.read(Buffer.from(maskPngBase64, "base64"));
  if (maskPng.width !== maskWidth || maskPng.height !== maskHeight) {
    throw new Error("mask_size_mismatch");
  }
  const channels = maskPng.data.length / (maskPng.width * maskPng.height);
  const cutout = new PNG({ width: photo.width, height: photo.height });
  for (let y = 0; y < photo.height; y += 1) {
    const maskY = Math.min(maskHeight - 1, Math.floor(((y + 0.5) * maskHeight) / photo.height));
    for (let x = 0; x < photo.width; x += 1) {
      const maskX = Math.min(maskWidth - 1, Math.floor(((x + 0.5) * maskWidth) / photo.width));
      const target = (y * photo.width + x) * 4;
      const source = target;
      cutout.data[target] = photo.data[source] ?? 0;
      cutout.data[target + 1] = photo.data[source + 1] ?? 0;
      cutout.data[target + 2] = photo.data[source + 2] ?? 0;
      cutout.data[target + 3] = maskOn(maskPng.data, channels, maskY * maskWidth + maskX) ? 255 : 0;
    }
  }
  return PNG.sync.write(cutout).toString("base64");
}
