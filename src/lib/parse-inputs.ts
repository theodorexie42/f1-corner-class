import type { CornerMark, SpeedPoint, TrackPoint } from "@/lib/corner-class";
import { polylineLength } from "@/lib/corner-class";

export type ParsedMap = {
  points: TrackPoint[];
  corners?: CornerMark[];
  name?: string;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function toMetres(xs: number[], ys: number[]): TrackPoint[] {
  const raw = xs.map((x, i) => ({ x, y: ys[i] }));
  const s = polylineLength(raw);
  const len = s[s.length - 1] || 0;
  if (len > 15000) return raw.map((p) => ({ x: p.x / 10, y: p.y / 10 }));
  return raw;
}

export function parseMapText(text: string, filename = ""): ParsedMap {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("err.mapEmpty");
  if (filename.endsWith(".csv") || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return { points: parseMapCsv(trimmed) };
  }
  const data = JSON.parse(trimmed) as unknown;
  return parseMapJson(data);
}

function parseMapCsv(text: string): TrackPoint[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const start = /[a-zA-Z]/.test(lines[0]) ? 1 : 0;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const line of lines.slice(start)) {
    const [a, b] = line.split(/[,;\s]+/);
    const x = asNumber(a);
    const y = asNumber(b);
    if (x == null || y == null) continue;
    xs.push(x);
    ys.push(y);
  }
  if (xs.length < 8) throw new Error("err.mapPoints");
  return toMetres(xs, ys);
}

function parseMapJson(data: unknown): ParsedMap {
  if (Array.isArray(data)) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const x = asNumber(o.x);
      const y = asNumber(o.y);
      if (x == null || y == null) continue;
      xs.push(x);
      ys.push(y);
    }
    if (xs.length < 8) throw new Error("err.mapPointsShort");
    return { points: toMetres(xs, ys) };
  }
  if (!data || typeof data !== "object") throw new Error("err.mapFormat");
  const o = data as Record<string, unknown>;
  const path = (o.trackPath && typeof o.trackPath === "object" ? o.trackPath : o) as Record<string, unknown>;
  const xs = path.x;
  const ys = path.y;
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length < 8) {
    throw new Error("err.mapXY");
  }
  const nx = xs.map(asNumber);
  const ny = ys.map(asNumber);
  if (nx.some((v) => v == null) || ny.some((v) => v == null)) throw new Error("err.mapNaN");
  const points = toMetres(nx as number[], ny as number[]);
  const lap = polylineLength(points).at(-1) || 0;
  const rawCorners =
    (o.features && typeof o.features === "object"
      ? (o.features as Record<string, unknown>).corners
      : o.corners) ?? undefined;
  let corners: CornerMark[] | undefined;
  if (Array.isArray(rawCorners) && rawCorners.length) {
    const seen = new Map<string, number>();
    corners = [];
    for (const c of rawCorners) {
      if (!c || typeof c !== "object") continue;
      const row = c as Record<string, unknown>;
      const alongRaw = asNumber(row.alongM) ?? asNumber(row.along_m) ?? asNumber(row.length);
      if (alongRaw == null) continue;
      const alongM = alongRaw > lap * 3 ? alongRaw / 10 : alongRaw;
      const num = row.number ?? row.label ?? corners.length + 1;
      const key = String(num);
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      const label = row.label ? String(row.label) : n === 1 ? key : `${key}${String.fromCharCode(64 + n - 1)}`;
      corners.push({ label, alongM });
    }
  }
  const name = typeof o.circuitName === "string" ? o.circuitName : typeof o.name === "string" ? o.name : undefined;
  return { points, corners, name };
}

export function parseSpeedText(text: string): SpeedPoint[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("err.speedEmpty");
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(data) ? data : (data as { speed?: unknown }).speed;
    if (!Array.isArray(rows)) throw new Error("err.speedArray");
    return rowsToSpeed(rows);
  }
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines[0].toLowerCase();
  const hasHeader = /[a-z]/.test(header);
  const timeBased = hasHeader && /time/.test(header) && !/dist/.test(header);
  const body = hasHeader ? lines.slice(1) : lines;
  const rows = body.map((line) => {
    const [a, b] = line.split(/[,;\s]+/);
    return timeBased ? { time_s: a, speed_kmh: b } : { d: a, v: b };
  });
  return rowsToSpeed(rows);
}

function rowsToSpeed(rows: unknown[]): SpeedPoint[] {
  const dist: SpeedPoint[] = [];
  const timed: { t: number; v: number }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const v = asNumber(o.v) ?? asNumber(o.speed) ?? asNumber(o.speed_kmh) ?? asNumber(o.kmh);
    const d = asNumber(o.d) ?? asNumber(o.distance) ?? asNumber(o.distance_m);
    const t = asNumber(o.t) ?? asNumber(o.time) ?? asNumber(o.time_s);
    if (v == null) continue;
    if (d != null) dist.push({ d, v });
    else if (t != null) timed.push({ t, v });
  }
  if (dist.length >= 4) return dist.sort((a, b) => a.d - b.d);
  if (timed.length >= 4) {
    timed.sort((a, b) => a.t - b.t);
    const out: SpeedPoint[] = [];
    let d = 0;
    out.push({ d: 0, v: timed[0].v });
    for (let i = 1; i < timed.length; i++) {
      const dt = timed[i].t - timed[i - 1].t;
      d += ((timed[i].v + timed[i - 1].v) / 2 / 3.6) * Math.max(0, dt);
      out.push({ d, v: timed[i].v });
    }
    return out;
  }
  throw new Error("err.speedRows");
}
