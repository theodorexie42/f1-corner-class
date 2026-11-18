export type CornerClass = "low" | "medium" | "high";

export type TrackPoint = { x: number; y: number };
export type SpeedPoint = { d: number; v: number };
export type CornerMark = { label: string; alongM: number };

export type GearPoint = { d: number; g: number };

export type CornerResult = {
  label: string;
  alongM: number;
  x: number;
  y: number;
  radiusM: number;
  headingDeg: number;
  arcM: number;
  minSpeed: number;
  minGear: number;
  geomSpeed: number;
  blendSpeed: number;
  speedClass: CornerClass;
  geomClass: CornerClass;
  gearClass: CornerClass | null;
  cornerClass: CornerClass;
  disagree: boolean;
  note: string;
};

export type ClassifyOptions = {
  /** 0 = 只看速度，1 = 只看几何。默认 0.45。 */
  geomWeight?: number;
};

const SPEED_LOW = 120;
const SPEED_HIGH = 200;

export function classFromSpeed(v: number, low = SPEED_LOW, high = SPEED_HIGH): CornerClass {
  if (v < low) return "low";
  if (v >= high) return "high";
  return "medium";
}

/** 把半径和转角换成一个“几何等效速度”，单位 km/h。急弯低，大半径小转角高。 */
export function geomSpeed(radiusM: number, headingDeg: number): number {
  const v = 70 + 0.95 * Math.min(radiusM, 220);
  const penalty = Math.max(0, headingDeg - 30) * 0.55;
  return Math.min(280, Math.max(70, v - penalty));
}

export function polylineLength(points: TrackPoint[]): number[] {
  const s = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    s.push(s[i - 1] + Math.hypot(dx, dy));
  }
  return s;
}

function idxAt(s: number[], dist: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < s.length; i++) {
    const d = Math.abs(s[i] - dist);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function pointAt(points: TrackPoint[], s: number[], dist: number): TrackPoint {
  const i = idxAt(s, dist);
  return points[i];
}

export function radiusAt(points: TrackPoint[], s: number[], dist: number, half = 28): number {
  const i = idxAt(s, dist);
  let j = i;
  while (j > 0 && s[i] - s[j] < half) j--;
  let k = i;
  while (k < s.length - 1 && s[k] - s[i] < half) k++;
  const a = points[j];
  const b = points[i];
  const c = points[k];
  const A = Math.hypot(b.x - a.x, b.y - a.y);
  const B = Math.hypot(c.x - b.x, c.y - b.y);
  const C = Math.hypot(a.x - c.x, a.y - c.y);
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  if (area < 1e-3) return 400;
  return Math.min(400, (A * B * C) / (4 * area));
}

export function headingChange(points: TrackPoint[], s: number[], dist: number, half = 42): number {
  const i = idxAt(s, dist);
  let j = i;
  while (j > 1 && s[i] - s[j] < half) j--;
  let k = i;
  while (k < s.length - 1 && s[k] - s[i] < half) k++;
  const heading = (n: number) => {
    const a = points[Math.max(0, n - 1)];
    const b = points[Math.min(points.length - 1, n + 1)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const d = heading(k) - heading(j);
  const wrapped = ((d + Math.PI) % (2 * Math.PI)) - Math.PI;
  const abs = Math.abs(wrapped);
  return (abs * 180) / Math.PI;
}

function minSpeedBetween(speed: SpeedPoint[], a: number, b: number): number {
  let m = Infinity;
  for (const p of speed) {
    if (p.d >= a && p.d <= b && p.v < m) m = p.v;
  }
  if (m === Infinity) {
    let best = speed[0];
    let bestD = Infinity;
    const mid = (a + b) / 2;
    for (const p of speed) {
      const d = Math.abs(p.d - mid);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? best.v : 0;
  }
  return m;
}

function cornerSpan(points: TrackPoint[], s: number[], dist: number, lap: number): [number, number] {
  const step = 4;
  let left = dist;
  let right = dist;
  for (let d = dist; d > Math.max(0, dist - 90); d -= step) {
    if (radiusAt(points, s, d) > 170) break;
    left = d;
  }
  for (let d = dist; d < Math.min(lap, dist + 90); d += step) {
    if (radiusAt(points, s, d) > 170) break;
    right = d;
  }
  if (right - left < 24) {
    left = Math.max(0, dist - 22);
    right = Math.min(lap, dist + 22);
  }
  return [left, right];
}

function minGearBetween(gear: GearPoint[], a: number, b: number): number {
  let m = Infinity;
  for (const p of gear) {
    if (p.d >= a && p.d <= b && p.g > 0 && p.g < m) m = p.g;
  }
  return m === Infinity ? 0 : m;
}

export function classFromGear(gear: number): CornerClass | null {
  if (!gear) return null;
  if (gear <= 3) return "low";
  if (gear >= 6) return "high";
  return "medium";
}

/** 速度、几何、挡位各投一票。两票相同就采用。挡位 1–3 不能被记成高速弯。 */
export function decideClass(
  speedClass: CornerClass,
  geomClass: CornerClass | null,
  gearClass: CornerClass | null,
): CornerClass {
  const votes = [speedClass, geomClass, gearClass].filter((v): v is CornerClass => v != null);
  const tally: Record<CornerClass, number> = { low: 0, medium: 0, high: 0 };
  for (const v of votes) tally[v] += 1;
  const order: CornerClass[] = ["low", "medium", "high"];
  order.sort((a, b) => tally[b] - tally[a] || (a === geomClass ? -1 : b === geomClass ? 1 : 0));
  let result = order[0];
  if (tally[order[0]] === tally[order[1]]) result = geomClass ?? speedClass;
  if (gearClass === "low" && result === "high") result = "medium";
  if (gearClass === "high" && geomClass === "high" && result === "low") result = "medium";
  if (!gearClass && speedClass === "high" && result === "low") result = "medium";
  if (!gearClass && speedClass === "low" && result === "high") result = "medium";
  return result;
}

function noteFor(
  speedClass: CornerClass,
  geomClass: CornerClass | null,
  gearClass: CornerClass | null,
  cornerClass: CornerClass,
  minGear: number,
): string {
  const same = speedClass === cornerClass && (geomClass == null || geomClass === cornerClass) && (gearClass == null || gearClass === cornerClass);
  if (same) return "速度、几何和挡位一致";
  const bits = [`速度${labelOf(speedClass)}`];
  if (geomClass) bits.push(`几何${labelOf(geomClass)}`);
  if (gearClass) bits.push(`${minGear}挡、${labelOf(gearClass)}`);
  if (gearClass === "low" && speedClass === "high") return `${bits.join("，")}。最低挡不超过 3，不记成高速弯`;
  if (speedClass !== cornerClass) return `${bits.join("，")}。综合记成${labelOf(cornerClass)}`;
  return bits.join("，");
}

function labelOf(c: CornerClass): string {
  return c === "low" ? "低速" : c === "high" ? "高速" : "中速";
}

export function scaleSpeedToLap(speed: SpeedPoint[], lapLength: number): SpeedPoint[] {
  if (speed.length < 2 || lapLength <= 0) return speed;
  const maxD = Math.max(...speed.map((p) => p.d));
  if (maxD <= 0) return speed;
  const ratio = lapLength / maxD;
  if (ratio > 0.82 && ratio < 1.22 && Math.abs(ratio - 1) > 0.03) {
    return speed.map((p) => ({ d: p.d * ratio, v: p.v }));
  }
  if (maxD < 1.5) {
    return speed.map((p) => ({ d: p.d * lapLength, v: p.v }));
  }
  return speed;
}

export function detectCorners(points: TrackPoint[], s: number[]): CornerMark[] {
  const lap = s[s.length - 1] || 0;
  const marks: { alongM: number; r: number }[] = [];
  let inRun = false;
  let runStart = 0;
  let bestR = Infinity;
  let bestD = 0;
  const flush = (end: number) => {
    if (!inRun) return;
    if (end - runStart >= 18 && bestR < 130) {
      marks.push({ alongM: bestD, r: bestR });
    }
    inRun = false;
    bestR = Infinity;
  };
  for (let d = 8; d < lap - 8; d += 6) {
    const r = radiusAt(points, s, d);
    if (r < 110) {
      if (!inRun) {
        inRun = true;
        runStart = d;
        bestR = r;
        bestD = d;
      } else if (r < bestR) {
        bestR = r;
        bestD = d;
      }
    } else if (inRun && d - runStart > 12) {
      flush(d);
    }
  }
  flush(lap);
  const merged: { alongM: number; r: number }[] = [];
  for (const m of marks) {
    const prev = merged[merged.length - 1];
    if (prev && m.alongM - prev.alongM < 45) {
      if (m.r < prev.r) merged[merged.length - 1] = m;
    } else {
      merged.push(m);
    }
  }
  return merged.map((m, i) => ({ label: String(i + 1), alongM: Math.round(m.alongM) }));
}

export function classifyTrack(
  points: TrackPoint[],
  speedIn: SpeedPoint[],
  corners: CornerMark[] | undefined,
  options: ClassifyOptions = {},
  gearIn: GearPoint[] = [],
): CornerResult[] {
  if (points.length < 8 || speedIn.length < 4) return [];
  const s = polylineLength(points);
  const lap = s[s.length - 1];
  const speed = scaleSpeedToLap(speedIn, lap);
  const gear = scaleSpeedToLap(
    gearIn.map((p) => ({ d: p.d, v: p.g })),
    lap,
  ).map((p) => ({ d: p.d, g: p.v }));
  const w = Math.min(1, Math.max(0, options.geomWeight ?? 0.45));
  const lowCut = SPEED_LOW + 15 * w;
  const highCut = SPEED_HIGH + 10 * w;
  const marks = corners && corners.length ? corners : detectCorners(points, s);
  return marks.map((mark) => {
    const along = ((mark.alongM % lap) + lap) % lap;
    const R = radiusAt(points, s, along);
    const dH = headingChange(points, s, along);
    const [a, b] = cornerSpan(points, s, along, lap);
    const vmin = minSpeedBetween(speed, a, b);
    const gmin = gear.length ? minGearBetween(gear, a, b) : 0;
    const vg = geomSpeed(R, dH);
    const speedClass = classFromSpeed(vmin);
    const geomClass = w > 0 ? classFromSpeed(vg, lowCut, highCut) : null;
    const gearClass = classFromGear(gmin);
    const cornerClass = decideClass(speedClass, geomClass, gearClass);
    const p = pointAt(points, s, along);
    return {
      label: mark.label,
      alongM: Math.round(along * 10) / 10,
      x: p.x,
      y: p.y,
      radiusM: Math.round(R),
      headingDeg: Math.round(dH),
      arcM: Math.round(b - a),
      minSpeed: Math.round(vmin),
      minGear: gmin,
      geomSpeed: Math.round(vg),
      blendSpeed: Math.round((1 - w) * vmin + w * vg),
      speedClass,
      geomClass: geomClass ?? speedClass,
      gearClass,
      cornerClass,
      disagree: speedClass !== cornerClass || (gearClass != null && gearClass !== cornerClass),
      note: noteFor(speedClass, geomClass, gearClass, cornerClass, gmin),
    };
  });
}

export function countClasses(rows: { cornerClass: CornerClass }[]): Record<CornerClass, number> {
  return {
    low: rows.filter((r) => r.cornerClass === "low").length,
    medium: rows.filter((r) => r.cornerClass === "medium").length,
    high: rows.filter((r) => r.cornerClass === "high").length,
  };
}
