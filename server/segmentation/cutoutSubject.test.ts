import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { cutoutSubjectPng } from "./cutoutSubject";

function pngBase64(width: number, height: number, paint: (png: PNG) => void): string {
  const png = new PNG({ width, height });
  paint(png);
  return PNG.sync.write(png).toString("base64");
}

describe("cutoutSubjectPng", () => {
  it("keeps the photo color inside the mask and clears the background", () => {
    const photo = pngBase64(4, 4, (png) => {
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 20;
        png.data[i + 1] = 80;
        png.data[i + 2] = 140;
        png.data[i + 3] = 255;
      }
    });
    const mask = pngBase64(2, 2, (png) => {
      for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 2; x += 1) {
          const on = x === 1 && y === 0;
          const index = (y * 2 + x) * 4;
          const value = on ? 255 : 0;
          png.data[index] = value;
          png.data[index + 1] = value;
          png.data[index + 2] = value;
          png.data[index + 3] = 255;
        }
      }
    });
    const cut = PNG.sync.read(Buffer.from(cutoutSubjectPng({ mimeType: "image/png", data: photo }, mask, 2, 2), "base64"));
    expect([cut.data[0], cut.data[1], cut.data[2], cut.data[3]]).toEqual([20, 80, 140, 0]);
    const kept = (0 * 4 + 2) * 4;
    expect([cut.data[kept], cut.data[kept + 1], cut.data[kept + 2], cut.data[kept + 3]]).toEqual([20, 80, 140, 255]);
  });
});
