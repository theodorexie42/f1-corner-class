import type { SpeedPoint, TrackPoint } from "./corner-class";

function pathLength(points: TrackPoint[]) {
  const s = [0];
  for (let i = 1; i < points.length; i++) {
    s.push(s[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return s;
}

export type SpeedNorm = { t: number; y: number };

const MAX_SIDE = 420;

function lumSat(data: Uint8ClampedArray, n: number) {
  const lum = new Float32Array(n);
  const sat = new Float32Array(n);
  const hue = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat[i] = max === 0 ? 0 : (max - min) / max;
    const d = max - min;
    let h = 0;
    if (d > 1e-6) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      if (h < 0) h += 6;
      h /= 6;
    }
    hue[i] = h;
  }
  return { lum, sat, hue };
}

function borderMedian(lum: Float32Array, w: number, h: number) {
  const sample: number[] = [];
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < band || y < band || x >= w - band || y >= h - band) sample.push(lum[y * w + x]);
    }
  }
  sample.sort((a, b) => a - b);
  return sample[Math.floor(sample.length / 2)] ?? 0;
}

function largestComponent(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  let best: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    const comp: number[] = [];
    while (stack.length) {
      const p = stack.pop() as number;
      comp.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      const nbs = [p + 1, p - 1, p + w, p - w];
      for (let k = 0; k < 4; k++) {
        const q = nbs[k];
        if (k === 0 && x === w - 1) continue;
        if (k === 1 && x === 0) continue;
        if (q < 0 || q >= mask.length || seen[q] || !mask[q]) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const out = new Uint8Array(w * h);
  for (const p of best) out[p] = 1;
  return out;
}

function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  const out = new Uint8Array(w * h);
  const r2 = r * r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1;
        }
      }
    }
  }
  return out;
}

function erode(mask: Uint8Array, w: number, h: number, r: number) {
  const out = new Uint8Array(w * h);
  const r2 = r * r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) out[y * w + x] = 1;
    }
  }
  return out;
}

function zhangSuen(mask: Uint8Array, w: number, h: number) {
  const m = new Uint8Array(mask);
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const del: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!m[i]) continue;
          const p2 = m[i - w];
          const p3 = m[i - w + 1];
          const p4 = m[i + 1];
          const p5 = m[i + w + 1];
          const p6 = m[i + w];
          const p7 = m[i + w - 1];
          const p8 = m[i - 1];
          const p9 = m[i - w - 1];
          const nb = [p2, p3, p4, p5, p6, p7, p8, p9];
          let b = 0;
          for (let k = 0; k < 8; k++) b += nb[k];
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!nb[k] && nb[(k + 1) % 8]) a++;
          if (a !== 1) continue;
          if (step === 0) {
            if (p2 && p4 && p6) continue;
            if (p4 && p6 && p8) continue;
          } else {
            if (p2 && p4 && p8) continue;
            if (p2 && p6 && p8) continue;
          }
          del.push(i);
        }
      }
      if (del.length) changed = true;
      for (const i of del) m[i] = 0;
    }
  }
  return m;
}

function neighborList(m: Uint8Array, w: number, h: number, p: number) {
  const x = p % w;
  const y = (p / w) | 0;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = yy * w + xx;
      if (m[q]) out.push(q);
    }
  }
  return out;
}

export function traceCenterline(mask: Uint8Array, w: number, h: number): TrackPoint[] {
  const skel = zhangSuen(mask, w, h);
  let start = -1;
  let startDeg = 99;
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i]) continue;
    const deg = neighborList(skel, w, h, i).length;
    if (deg === 2) {
      start = i;
      break;
    }
    if (deg > 0 && deg < startDeg) {
      startDeg = deg;
      start = i;
    }
  }
  if (start < 0) return [];
  const seen = new Uint8Array(skel.length);
  const path = [start];
  seen[start] = 1;
  let prev = -1;
  let cur = start;
  for (let guard = 0; guard < skel.length; guard++) {
    const nbs = neighborList(skel, w, h, cur).filter((q) => !seen[q]);
    if (!nbs.length) break;
    let next = nbs[0];
    if (nbs.length > 1 && prev >= 0) {
      const px = (prev % w) - (cur % w);
      const py = ((prev / w) | 0) - ((cur / w) | 0);
      let best = Infinity;
      for (const q of nbs) {
        const qx = (q % w) - (cur % w);
        const qy = ((q / w) | 0) - ((cur / w) | 0);
        const turn = Math.abs(Math.atan2(qy, qx) - Math.atan2(py, px));
        const folded = Math.min(turn, Math.PI * 2 - turn);
        if (folded < best) {
          best = folded;
          next = q;
        }
      }
    }
    seen[next] = 1;
    path.push(next);
    prev = cur;
    cur = next;
  }
  if (path.length < 24) return [];
  return path.map((p) => ({ x: p % w, y: (p / w) | 0 }));
}

export function resample(points: TrackPoint[], count = 220): TrackPoint[] {
  if (points.length < 2) return points;
  const s = pathLength(points);
  const lap = s[s.length - 1];
  if (lap <= 0) return points;
  const out: TrackPoint[] = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const target = (lap * i) / count;
    while (j < s.length - 2 && s[j + 1] < target) j++;
    const span = s[j + 1] - s[j] || 1;
    const t = (target - s[j]) / span;
    out.push({
      x: points[j].x + (points[j + 1].x - points[j].x) * t,
      y: points[j].y + (points[j + 1].y - points[j].y) * t,
    });
  }
  return out;
}

export function scaleToLength(pixels: TrackPoint[], lapM: number): TrackPoint[] {
  const s = pathLength(pixels);
  const len = s[s.length - 1] || 1;
  const k = lapM / len;
  let cx = 0;
  let cy = 0;
  for (const p of pixels) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pixels.length;
  cy /= pixels.length;
  return pixels.map((p) => ({ x: (p.x - cx) * k, y: (cy - p.y) * k }));
}

function maskFromMode(lum: Float32Array, sat: Float32Array, w: number, h: number, mode: "ribbon" | "dark" | "light") {
  const bg = borderMedian(lum, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < lum.length; i++) {
    const L = lum[i];
    const S = sat[i];
    let on = false;
    if (mode === "ribbon") on = L > bg + 0.08 && L < bg + 0.55 && S < 0.42;
    else if (mode === "dark") on = L < bg - 0.18 && S < 0.55;
    else on = L > bg + 0.22 && S < 0.38;
    if (on) mask[i] = 1;
  }
  const closed = erode(dilate(mask, w, h, 1), w, h, 1);
  return largestComponent(closed, w, h);
}

export function centerlineFromRaster(data: Uint8ClampedArray, w: number, h: number): TrackPoint[] {
  const { lum, sat } = lumSat(data, w * h);
  let best: TrackPoint[] = [];
  for (const mode of ["ribbon", "dark", "light"] as const) {
    const mask = maskFromMode(lum, sat, w, h, mode);
    const area = mask.reduce((a, v) => a + v, 0);
    if (area < 40) continue;
    const line = traceCenterline(mask, w, h);
    if (line.length > best.length) best = line;
  }
  return resample(best);
}

function drawRaster(img: HTMLImageElement) {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("err.canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("err.imageOpen"));
    };
    img.src = url;
  });
}

export async function traceTrackImage(file: File): Promise<TrackPoint[]> {
  const img = await loadImage(file);
  const { data, w, h } = drawRaster(img);
  const line = centerlineFromRaster(data, w, h);
  if (line.length < 40) {
    throw new Error("err.noCenterline");
  }
  return line;
}

export function findPlotBox(lum: Float32Array, w: number, h: number) {
  const bg = borderMedian(lum, w, h);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < lum.length; i++) if (Math.abs(lum[i] - bg) > 0.16) ink[i] = 1;
  let bestRow = -1;
  let bestRowScore = 0;
  for (let y = Math.floor(h * 0.4); y < h * 0.94; y++) {
    let run = 0;
    let best = 0;
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x]) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
    if (best > bestRowScore) {
      bestRowScore = best;
      bestRow = y;
    }
  }
  let bestCol = -1;
  let bestColScore = 0;
  for (let x = Math.floor(w * 0.02); x < w * 0.45; x++) {
    let run = 0;
    let best = 0;
    for (let y = 0; y < h; y++) {
      if (ink[y * w + x]) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
    if (best > bestColScore) {
      bestColScore = best;
      bestCol = x;
    }
  }
  if (bestRow < 0 || bestCol < 0 || bestRowScore < w * 0.28 || bestColScore < h * 0.28) {
    return {
      x0: Math.round(w * 0.12),
      y0: Math.round(h * 0.12),
      x1: Math.round(w * 0.94),
      y1: Math.round(h * 0.86),
    };
  }
  let x1 = bestCol;
  for (let x = w - 1; x > bestCol; x--) {
    if (ink[bestRow * w + x]) {
      x1 = x;
      break;
    }
  }
  let y0 = 0;
  for (let y = 0; y < bestRow; y++) {
    if (ink[y * w + bestCol]) {
      y0 = y;
      break;
    }
  }
  if (x1 - bestCol < w * 0.3) x1 = Math.round(w * 0.94);
  if (bestRow - y0 < h * 0.25) y0 = Math.round(h * 0.1);
  return { x0: bestCol + 1, y0: y0 + 1, x1: x1 - 1, y1: bestRow - 1 };
}

function seriesScore(pts: { x: number; y: number }[], width: number) {
  if (pts.length < width * 0.45) return -1;
  let mean = 0;
  for (const p of pts) mean += p.y;
  mean /= pts.length;
  let v = 0;
  for (const p of pts) v += (p.y - mean) ** 2;
  return Math.sqrt(v / pts.length);
}

function followLine(
  match: (i: number) => boolean,
  w: number,
  box: { x0: number; y0: number; x1: number; y1: number },
) {
  const pts: { x: number; y: number }[] = [];
  let prev = -1;
  for (let x = box.x0; x <= box.x1; x++) {
    let bestY = -1;
    let best = Infinity;
    for (let y = box.y0; y <= box.y1; y++) {
      const i = y * w + x;
      if (!match(i)) continue;
      const jump = prev < 0 ? 0 : Math.abs(y - prev);
      if (jump < best) {
        best = jump;
        bestY = y;
      }
    }
    if (bestY < 0) continue;
    if (prev >= 0 && Math.abs(bestY - prev) > 36) continue;
    pts.push({ x, y: bestY });
    prev = bestY;
  }
  return pts;
}

export function speedNormFromRaster(data: Uint8ClampedArray, w: number, h: number): SpeedNorm[] {
  const { lum, sat, hue } = lumSat(data, w * h);
  const box = findPlotBox(lum, w, h);
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  if (width < 20 || height < 20) throw new Error("err.noAxes");

  const bins = new Array(24).fill(0);
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const i = y * w + x;
      if (sat[i] > 0.45) bins[Math.min(23, Math.floor(hue[i] * 24))]++;
    }
  }
  let hueBin = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i] > bins[hueBin]) hueBin = i;
  const hueCenter = (hueBin + 0.5) / 24;

  const candidates = [
    followLine((i) => lum[i] > 0.78 && sat[i] < 0.45, w, box),
    followLine((i) => lum[i] < 0.22 && sat[i] < 0.45, w, box),
    followLine((i) => {
      if (sat[i] < 0.45) return false;
      const d = Math.abs(hue[i] - hueCenter);
      return Math.min(d, 1 - d) < 0.08;
    }, w, box),
  ];
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = seriesScore(c, width);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best.length || bestScore < 4) {
    throw new Error("err.noSpeedTrace");
  }
  const span = best[best.length - 1].x - best[0].x || 1;
  return best.map((p) => ({
    t: (p.x - box.x0) / (box.x1 - box.x0 || 1),
    y: (p.y - box.y0) / (height || 1),
  })).filter((p) => p.t >= 0 && p.t <= 1 + 1 / span);
}

export function speedFromNorm(norm: SpeedNorm[], lapM: number, vmin: number, vmax: number): SpeedPoint[] {
  return norm.map((p) => ({
    d: Math.min(1, Math.max(0, p.t)) * lapM,
    v: vmax - Math.min(1, Math.max(0, p.y)) * (vmax - vmin),
  }));
}

export async function traceSpeedImage(file: File): Promise<SpeedNorm[]> {
  const img = await loadImage(file);
  const { data, w, h } = drawRaster(img);
  return speedNormFromRaster(data, w, h);
}
