import assert from "node:assert/strict";
import test from "node:test";
import { classifyTrack, decideClass, geomSpeed } from "./corner-class.ts";

test("hairpin radius and low speed stay low", () => {
  const points = [];
  for (let a = 0; a <= Math.PI; a += 0.04) {
    points.push({ x: 32 * Math.cos(a), y: 32 * Math.sin(a) });
  }
  const speed = points.map((_, i) => ({ d: i * 4, v: 80 }));
  const rows = classifyTrack(points, speed, [{ label: "1", alongM: 50 }], { geomWeight: 0.45 });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].radiusM < 50, `radius ${rows[0].radiusM}`);
  assert.equal(rows[0].cornerClass, "low");
});

test("fast kink stays high", () => {
  const points = [];
  for (let i = 0; i < 80; i++) points.push({ x: i * 8, y: i < 40 ? 0 : (i - 40) * 0.35 });
  const speed = points.map((_, i) => ({ d: i * 8, v: 270 }));
  const rows = classifyTrack(points, speed, [{ label: "1", alongM: 200 }], { geomWeight: 0.45 });
  assert.equal(rows[0].cornerClass, "high");
  assert.equal(rows[0].speedClass, "high");
});

test("tight corner taken quickly is not called high", () => {
  const points = [];
  for (let a = -0.9; a <= 0.9; a += 0.03) {
    points.push({ x: 48 * Math.sin(a), y: 48 * (1 - Math.cos(a)) });
  }
  const speed = points.map((_, i) => ({ d: i * 3, v: i > 18 && i < 42 ? 210 : 260 }));
  const mid = (points.length * 3) / 2;
  const rows = classifyTrack(points, speed, [{ label: "1", alongM: mid }], { geomWeight: 0.45 });
  assert.equal(rows[0].speedClass, "high");
  assert.notEqual(rows[0].cornerClass, "high");
  assert.equal(rows[0].disagree, true);
});

test("geom speed falls as the corner gets tighter", () => {
  assert.ok(geomSpeed(30, 110) < geomSpeed(200, 20));
});

test("a fast straight in second gear is not called a high-speed corner", () => {
  const points = [];
  for (let i = 0; i < 80; i++) points.push({ x: i * 8, y: 0 });
  const speed = points.map((_, i) => ({ d: i * 8, v: 250 }));
  const gear = points.map((_, i) => ({ d: i * 8, g: 2 }));
  const rows = classifyTrack(points, speed, [{ label: "1", alongM: 200 }], { geomWeight: 0.45 }, gear);
  assert.equal(rows[0].speedClass, "high");
  assert.equal(rows[0].minGear, 2);
  assert.equal(rows[0].gearClass, "low");
  assert.notEqual(rows[0].cornerClass, "high");
});

test("two votes beat one", () => {
  assert.equal(decideClass("high", "high", "low"), "medium");
  assert.equal(decideClass("low", "low", "medium"), "low");
  assert.equal(decideClass("medium", "high", "high"), "high");
  assert.equal(decideClass("high", "low", null), "medium");
});
