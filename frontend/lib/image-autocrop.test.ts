import { describe, expect, test } from "vitest";

import { autoCropRect, type PixelSample } from "./image-autocrop";

/**
 * Flat grey canvas with an optional band of high-frequency noise.
 *
 * Noise stands in for the product: gradient energy is what the algorithm
 * actually keys on, and a checkerboard produces it at every pixel while a
 * solid block would only register at its four edges.
 */
function sample(width: number, height: number, detail?: { top: number; bottom: number }): PixelSample {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inBand = detail && y >= detail.top && y < detail.bottom;
      const value = inBand ? ((x + y) % 2 === 0 ? 20 : 235) : 128;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

// 60x120 is 1:2; asking for 4:5 (0.8) leaves 45px of vertical freedom, which
// is enough room for placement to be meaningfully right or wrong.
const TALL = { w: 60, h: 120 };
const FOUR_FIVE = 4 / 5;

describe("autoCropRect", () => {
  test("moves the window up when the detail sits near the top", () => {
    const rect = autoCropRect(sample(TALL.w, TALL.h, { top: 5, bottom: 35 }), FOUR_FIVE);
    // Centre placement would be y = 22.5/120 = 0.1875; the top band has to pull
    // it well below that to have kept the product in frame.
    expect(rect.y).toBeLessThan(0.1);
    expect(rect.x).toBe(0);
  });

  test("moves the window down when the detail sits near the bottom", () => {
    const rect = autoCropRect(sample(TALL.w, TALL.h, { top: 85, bottom: 115 }), FOUR_FIVE);
    expect(rect.y).toBeGreaterThan(0.28);
  });

  test("stays centred when the image is uniform", () => {
    const rect = autoCropRect(sample(TALL.w, TALL.h), FOUR_FIVE);
    expect(rect.y).toBeCloseTo(22.5 / 120, 1);
  });

  test("never crops more than the target shape requires", () => {
    const rect = autoCropRect(sample(TALL.w, TALL.h, { top: 5, bottom: 35 }), FOUR_FIVE);
    // Widest possible window for 4:5 inside 60x120 is 60x75.
    expect(rect.w).toBeCloseTo(1, 5);
    expect(rect.h).toBeCloseTo(75 / 120, 5);
    // And it must stay inside the source.
    expect(rect.y + rect.h).toBeLessThanOrEqual(1.000001);
  });

  test("returns the whole image when it already matches the target shape", () => {
    const rect = autoCropRect(sample(80, 100), FOUR_FIVE);
    expect(rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  test("crops horizontally for a landscape source", () => {
    const rect = autoCropRect(sample(200, 100, { top: 0, bottom: 100 }), FOUR_FIVE);
    // 4:5 inside 200x100 is an 80x100 window, so all the freedom is on x.
    expect(rect.h).toBeCloseTo(1, 5);
    expect(rect.w).toBeCloseTo(80 / 200, 5);
  });

  test("falls back to the whole image on degenerate input", () => {
    expect(autoCropRect(sample(0, 0), FOUR_FIVE)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(autoCropRect(sample(10, 10), 0)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(autoCropRect(sample(10, 10), Number.NaN)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
