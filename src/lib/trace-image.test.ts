import assert from "node:assert/strict";
import test from "node:test";
import { centerlineFromRaster, traceCenterline } from "./trace-image.ts";

test("a drawn ring becomes one centerline", () => {
  const w = 96;
  const h = 96;
  const mask = new Uint8Array(w * h);
  const cx = 48;
  const cy = 48;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 26 && d < 31) mask[y * w + x] = 1;
    }
  }
  const line = traceCenterline(mask, w, h);
  assert.ok(line.length > 40, `got ${line.length}`);
  let mean = 0;
  for (const p of line) mean += Math.hypot(p.x - cx, p.y - cy);
  mean /= line.length;
  let spread = 0;
  for (const p of line) spread += (Math.hypot(p.x - cx, p.y - cy) - mean) ** 2;
  spread = Math.sqrt(spread / line.length);
  assert.ok(spread < 3, `spread ${spread}`);
});

test("grey ribbon on a dark image is traced", () => {
  const w = 80;
  const h = 80;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 16;
    data[i * 4 + 1] = 18;
    data[i * 4 + 2] = 22;
    data[i * 4 + 3] = 255;
  }
  const cx = 40;
  const cy = 40;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 22 && d < 28) {
        const i = y * w + x;
        data[i * 4] = 150;
        data[i * 4 + 1] = 150;
        data[i * 4 + 2] = 148;
      }
    }
  }
  const line = centerlineFromRaster(data, w, h);
  assert.ok(line.length > 40, `got ${line.length}`);
});
