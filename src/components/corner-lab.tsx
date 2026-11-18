import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as Slider from "@radix-ui/react-slider";
import { classifyTrack, countClasses, type CornerClass, type CornerResult, type TrackPoint } from "@/lib/corner-class";
import { classLabel, explainRow, formatRef, formatSource, raceName, text, translateError, type CopyKey, type Lang } from "@/lib/copy";
import { parseMapText, parseSpeedText, type ParsedMap } from "@/lib/parse-inputs";
import { scaleToLength, speedFromNorm, traceSpeedImage, traceTrackImage, type SpeedNorm } from "@/lib/trace-image";
import indexData from "../../public/data/index.json";
import australia from "../../public/data/r01.json";

type RaceIndex = { id: string; round: number; name: string; circuit: string; ref: string };
type RaceDoc = RaceIndex & {
  lapLengthM: number;
  x: number[];
  y: number[];
  corners: { label: string; alongM: number }[];
  speed: { d: number; v: number }[];
  gear?: { d: number; g: number }[];
  map?: string;
  source?: string;
};

const CLASS_COLOR: Record<CornerClass, string> = {
  low: "var(--color-low)",
  medium: "var(--color-mid)",
  high: "var(--color-high)",
};

type ShortcutAction = "zh" | "en" | "prev" | "next" | "download";
type Shortcuts = Record<ShortcutAction, string>;

const DEFAULT_KEYS: Shortcuts = { zh: "z", en: "e", prev: "[", next: "]", download: "d" };
const SHORTCUT_ACTIONS: ShortcutAction[] = ["zh", "en", "prev", "next", "download"];

function loadShortcuts(): Shortcuts {
  try {
    const raw = window.localStorage.getItem("corner-keys");
    if (!raw) return DEFAULT_KEYS;
    const parsed = JSON.parse(raw) as Partial<Shortcuts>;
    const next = { ...DEFAULT_KEYS };
    for (const action of SHORTCUT_ACTIONS) {
      const key = parsed[action];
      if (typeof key === "string" && key.length > 0 && key.length < 16) next[action] = key;
    }
    return next;
  } catch {
    return DEFAULT_KEYS;
  }
}

function showKey(key: string) {
  return key.length === 1 ? key.toUpperCase() : key;
}

function pointsOf(doc: { x: number[]; y: number[] }) {
  return doc.x.map((x, i) => ({ x, y: doc.y[i] }));
}

export function CornerLab() {
  const [lang, setLang] = useState<Lang>("zh");
  const t = (key: CopyKey) => text(lang, key);
  const [races, setRaces] = useState<RaceIndex[]>(indexData as RaceIndex[]);
  const [raceId, setRaceId] = useState("r01");
  const [doc, setDoc] = useState<RaceDoc | null>(australia as RaceDoc);
  const [upload, setUpload] = useState<ParsedMap | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<{ d: number; v: number }[] | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [weight, setWeight] = useState(0.45);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pixelLine, setPixelLine] = useState<TrackPoint[] | null>(null);
  const [speedNorm, setSpeedNorm] = useState<SpeedNorm[] | null>(null);
  const [mapName, setMapName] = useState("");
  const [lapM, setLapM] = useState(5300);
  const [vmin, setVmin] = useState(0);
  const [vmax, setVmax] = useState(350);
  const [busy, setBusy] = useState<CopyKey | "">("");
  const [keys, setKeys] = useState<Shortcuts>(DEFAULT_KEYS);
  const [listening, setListening] = useState<ShortcutAction | null>(null);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("corner-lang");
    if (saved === "en" || saved === "zh") setLang(saved);
    setKeys(loadShortcuts());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.title = text(lang, "title");
  }, [lang]);

  function chooseLang(next: Lang) {
    setLang(next);
    window.localStorage.setItem("corner-lang", next);
  }

  useEffect(() => {
    if (!pixelLine) return;
    setUpload({ points: scaleToLength(pixelLine, lapM), name: mapName || text(lang, "mapFallback") });
  }, [pixelLine, lapM, mapName, lang]);

  useEffect(() => {
    if (!speedNorm) return;
    setUploadSpeed(speedFromNorm(speedNorm, lapM, vmin, vmax));
  }, [speedNorm, lapM, vmin, vmax]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/index.json")
      .then((r) => r.json())
      .then((rows: RaceIndex[]) => {
        if (!cancelled) setRaces(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError("err.index");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (upload && uploadSpeed) return;
    let cancelled = false;
    fetch(`/data/${raceId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((row: RaceDoc) => {
        if (!cancelled) {
          setDoc(row);
          setSelected(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("err.race");
      });
    return () => {
      cancelled = true;
    };
  }, [raceId, upload, uploadSpeed]);

  const custom = Boolean(upload || uploadSpeed);
  const points = upload ? upload.points : custom ? [] : doc ? pointsOf(doc) : [];
  const speed = uploadSpeed ? uploadSpeed : custom ? [] : doc ? doc.speed : [];
  const gear = uploadSpeed ? [] : custom ? [] : doc?.gear || [];
  const marks = custom ? upload?.corners : doc?.corners;

  const rows = useMemo(
    () => (points.length && speed.length ? classifyTrack(points, speed, marks, { geomWeight: weight }, gear) : []),
    [points, speed, marks, weight, gear],
  );
  const counts = countClasses(rows);
  const speedOnly = {
    low: rows.filter((r) => r.speedClass === "low").length,
    medium: rows.filter((r) => r.speedClass === "medium").length,
    high: rows.filter((r) => r.speedClass === "high").length,
  };
  const title = upload?.name || (custom ? t("uploadedTrack") : doc ? `${raceName(lang, doc.id, doc.name)} · ${doc.circuit}` : t("loading"));
  const ref = custom ? (uploadSpeed ? t("customSpeed") : t("noSpeed")) : doc?.ref ? formatRef(lang, doc.ref) : "";

  function clearCustom() {
    setUpload(null);
    setUploadSpeed(null);
    setPixelLine(null);
    setSpeedNorm(null);
    setUploadError("");
    setSelected(null);
  }

  function isImage(file: File) {
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
  }

  function onMapFile(file: File) {
    if (isImage(file)) {
      setBusy("busy.track");
      setUploadError("");
      traceTrackImage(file)
        .then((line) => {
          setMapName(file.name.replace(/\.[^.]+$/, ""));
          setPixelLine(line);
          setSelected(null);
          setBusy("");
        })
        .catch((err: unknown) => {
          setBusy("");
          setUploadError(err instanceof Error ? err.message : "err.generic");
        });
      return;
    }
    setPixelLine(null);
    file.text().then((text) => {
      try {
        const parsed = parseMapText(text, file.name);
        setUpload(parsed);
        setMapName(parsed.name || file.name);
        setUploadError("");
        setSelected(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "err.generic");
      }
    });
  }

  function onSpeedFile(file: File) {
    if (isImage(file)) {
      setBusy("busy.speed");
      setUploadError("");
      traceSpeedImage(file)
        .then((norm) => {
          setSpeedNorm(norm);
          setSelected(null);
          setBusy("");
        })
        .catch((err: unknown) => {
          setBusy("");
          setUploadError(err instanceof Error ? err.message : "err.generic");
        });
      return;
    }
    setSpeedNorm(null);
    file.text().then((text) => {
      try {
        setUploadSpeed(parseSpeedText(text));
        setUploadError("");
        setSelected(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "err.generic");
      }
    });
  }

  function download() {
    const header = [
      "corner",
      "along_m",
      "radius_m",
      "heading_deg",
      "arc_m",
      "min_speed_kmh",
      "min_gear",
      "geom_speed",
      "speed_only",
      "geom_vote",
      "gear_vote",
      "corner_class",
      "note",
    ];
    const body = rows.map((r) =>
      [
        r.label,
        r.alongM,
        r.radiusM,
        r.headingDeg,
        r.arcM,
        r.minSpeed,
        r.minGear || "",
        r.geomSpeed,
        r.speedClass,
        r.geomClass,
        r.gearClass ?? "",
        r.cornerClass,
        explainRow(lang, r),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corner-class.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function stepRace(dir: 1 | -1) {
    if (!races.length) return;
    const ids = races.map((r) => r.id);
    const index = Math.max(0, ids.indexOf(raceId));
    const next = ids[(index + dir + ids.length) % ids.length];
    clearCustom();
    setRaceId(next);
  }

  function saveKeys(next: Shortcuts) {
    setKeys(next);
    window.localStorage.setItem("corner-keys", JSON.stringify(next));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typed = event.target instanceof HTMLElement && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT" || event.target.isContentEditable);
      if (listening) {
        event.preventDefault();
        if (event.key === "Escape") {
          setListening(null);
          setKeyError("");
          return;
        }
        if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta") return;
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (SHORTCUT_ACTIONS.some((action) => action !== listening && keys[action] === key)) {
          setKeyError(text(lang, "shortcutTaken"));
          return;
        }
        saveKeys({ ...keys, [listening]: key });
        setListening(null);
        setKeyError("");
        return;
      }
      if (typed || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const action = SHORTCUT_ACTIONS.find((item) => keys[item] === key);
      if (!action) return;
      event.preventDefault();
      if (action === "zh") chooseLang("zh");
      else if (action === "en") chooseLang("en");
      else if (action === "prev") stepRace(-1);
      else if (action === "next") stepRace(1);
      else if (rows.length) download();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const shortcutLabel: Record<ShortcutAction, CopyKey> = {
    zh: "actZh",
    en: "actEn",
    prev: "actPrev",
    next: "actNext",
    download: "actDownload",
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-sm text-muted">{t("kicker")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="max-w-2xl text-muted">{t("intro")}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <span className="text-sm text-muted">{t("language")}</span>
          <div className="flex h-11 overflow-hidden rounded-xl border border-line" role="group" aria-label={t("language")}>
            <button
              type="button"
              aria-pressed={lang === "zh"}
              className={lang === "zh" ? "bg-accent px-4 font-medium text-fg" : "px-4 text-muted"}
              onClick={() => chooseLang("zh")}
            >
              中文
            </button>
            <button
              type="button"
              aria-pressed={lang === "en"}
              className={lang === "en" ? "bg-accent px-4 font-medium text-fg" : "px-4 text-muted"}
              onClick={() => chooseLang("en")}
            >
              English
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="text-sm">{t("shortcuts")}</span>
            {SHORTCUT_ACTIONS.map((action) => (
              <div key={action} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">{t(shortcutLabel[action])}</span>
                <button
                  type="button"
                  className={listening === action ? "h-11 min-w-16 rounded-xl bg-accent px-3 font-mono text-fg" : "h-11 min-w-16 rounded-xl border border-line bg-bg px-3 font-mono text-fg"}
                  onClick={() => {
                    setKeyError("");
                    setListening(listening === action ? null : action);
                  }}
                >
                  {listening === action ? t("pressKey") : showKey(keys[action])}
                </button>
              </div>
            ))}
            <p className="text-sm text-muted">{t("shortcutHint")}</p>
            {keyError ? <p className="text-sm text-low">{keyError}</p> : null}
            <button
              type="button"
              className="h-11 rounded-xl border border-line text-sm text-muted"
              onClick={() => {
                saveKeys(DEFAULT_KEYS);
                setListening(null);
                setKeyError("");
              }}
            >
              {t("shortcutReset")}
            </button>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">{t("round")}</span>
            <select
              className="h-11 rounded-xl border border-line bg-surface px-3 text-fg"
              value={custom ? "" : raceId}
              onChange={(e) => {
                clearCustom();
                setRaceId(e.target.value);
              }}
            >
              {custom ? <option value="">{t("usingUpload")}</option> : null}
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.round} {raceName(lang, r.id, r.name)}
                </option>
              ))}
            </select>
          </label>

          <FileSlot id="track-file" label={t("trackMap")} hint={t("trackHint")} readyLabel={t("loadedSwap")} ready={Boolean(upload)} onFile={onMapFile} />
          <FileSlot id="speed-file" label={t("speedFile")} hint={t("speedHint")} readyLabel={t("loadedSwap")} ready={Boolean(uploadSpeed)} onFile={onSpeedFile} />
          {busy ? <p className="text-sm text-muted">{t(busy)}</p> : null}
          {upload && !uploadSpeed ? <p className="text-sm text-mid">{t("needSpeed")}</p> : null}
          {uploadSpeed && !upload ? <p className="text-sm text-mid">{t("needMap")}</p> : null}
          {uploadError ? <p className="text-sm text-low">{translateError(lang, uploadError)}</p> : null}
          {loadError && !custom ? <p className="text-sm text-low">{translateError(lang, loadError)}</p> : null}

          {pixelLine || speedNorm ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <NumberField label={t("lapLength")} value={lapM} min={1000} max={8000} onChange={setLapM} />
              <NumberField label={t("vmin")} value={vmin} min={0} max={200} onChange={setVmin} />
              <NumberField label={t("vmax")} value={vmax} min={100} max={400} onChange={setVmax} />
              <p className="text-sm text-muted">{t("scaleHint")}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{t("geomWeight")}</span>
              <span className="font-mono text-sm text-muted">{Math.round(weight * 100)}%</span>
            </div>
            <Slider.Root
              className="relative flex h-11 w-full touch-none items-center"
              min={0}
              max={100}
              step={5}
              value={[Math.round(weight * 100)]}
              onValueChange={(v) => setWeight((v[0] ?? 45) / 100)}
            >
              <Slider.Track className="relative h-1 grow rounded-full bg-line">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block size-5 rounded-full border border-line bg-fg" aria-label={t("geomWeight")} />
            </Slider.Root>
            <p className="text-sm text-muted">{t("geomHint")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="font-mono text-sm text-muted">{ref}</p>
              {doc && !custom && doc.source ? <p className="mt-1 max-w-xl text-sm text-muted">{formatSource(lang, doc.source)}</p> : null}
            </div>
            <button
              type="button"
              className="h-11 rounded-xl bg-accent px-4 font-medium text-fg disabled:opacity-40"
              disabled={!rows.length}
              onClick={download}
            >
              {t("download")}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Count label={t("low")} value={counts.low} other={speedOnly.low} aside={t("speedOnly")} tone="low" />
            <Count label={t("medium")} value={counts.medium} other={speedOnly.medium} aside={t("speedOnly")} tone="mid" />
            <Count label={t("high")} value={counts.high} other={speedOnly.high} aside={t("speedOnly")} tone="high" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-3">
              {doc?.map && !custom ? (
                <img src={doc.map} alt={`${title} ${t("mapAlt")}`} className="h-auto w-full" />
              ) : (
                <p className="px-2 py-16 text-center text-muted">{t("officialEmpty")}</p>
              )}
              <p className="px-1 pt-2 text-sm text-muted">{t("officialMap")}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              {points.length ? (
                <TrackMap points={points} rows={rows} selected={selected} onSelect={setSelected} />
              ) : (
                <p className="px-2 py-16 text-center text-muted">{t("pickOrUpload")}</p>
              )}
              <p className="px-1 pt-2 text-sm text-muted">{t("centerline")}</p>
            </div>
          </div>

          <div className="h-56 rounded-xl border border-line bg-surface p-2">
            {speed.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={speed} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="d" type="number" domain={[0, "dataMax"]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-line)" />
                  <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-line)" width={40} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }}
                    formatter={(value) => [`${value} km/h`, t("speedTip")]}
                    labelFormatter={(d) => `${d} m`}
                  />
                  {rows.map((r) => (
                    <ReferenceArea
                      key={r.label}
                      x1={Math.max(0, r.alongM - r.arcM / 2)}
                      x2={r.alongM + r.arcM / 2}
                      fill={CLASS_COLOR[r.cornerClass]}
                      fillOpacity={selected === r.label ? 0.38 : 0.16}
                    />
                  ))}
                  <Line type="monotone" dataKey="v" stroke="var(--color-track)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="px-2 py-16 text-center text-muted">{t("speedEmpty")}</p>
            )}
          </div>
          <div className="h-40 rounded-xl border border-line bg-surface p-2">
            {gear.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gear} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="d" type="number" domain={[0, "dataMax"]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-line)" />
                  <YAxis domain={[0, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-line)" width={40} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }}
                    formatter={(value) => [`${value}`, t("gearTip")]}
                    labelFormatter={(d) => `${d} m`}
                  />
                  {rows.map((r) => (
                    <ReferenceArea
                      key={r.label}
                      x1={Math.max(0, r.alongM - r.arcM / 2)}
                      x2={r.alongM + r.arcM / 2}
                      fill={CLASS_COLOR[r.cornerClass]}
                      fillOpacity={selected === r.label ? 0.38 : 0.16}
                    />
                  ))}
                  <Line type="stepAfter" dataKey="g" stroke="var(--color-mid)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="px-2 py-10 text-center text-muted">{t("gearEmpty")}</p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">{t("colCorner")}</th>
              <th className="px-3 py-3 font-medium">{t("colRadius")}</th>
              <th className="px-3 py-3 font-medium">{t("colHeading")}</th>
              <th className="px-3 py-3 font-medium">{t("colMinSpeed")}</th>
              <th className="px-3 py-3 font-medium">{t("colMinGear")}</th>
              <th className="px-3 py-3 font-medium">{t("colSpeed")}</th>
              <th className="px-3 py-3 font-medium">{t("colGeom")}</th>
              <th className="px-3 py-3 font-medium">{t("colGear")}</th>
              <th className="px-3 py-3 font-medium">{t("colCombined")}</th>
              <th className="px-3 py-3 font-medium">{t("colNote")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className={selected === r.label ? "bg-surface-2" : "bg-bg"}
                onClick={() => setSelected(r.label)}
              >
                <td className="px-3 py-3 font-mono">{r.label}</td>
                <td className="px-3 py-3 font-mono">{r.radiusM}</td>
                <td className="px-3 py-3 font-mono">{r.headingDeg}</td>
                <td className="px-3 py-3 font-mono">{r.minSpeed}</td>
                <td className="px-3 py-3 font-mono">{r.minGear || "—"}</td>
                <td className="px-3 py-3">{classLabel(lang, r.speedClass)}</td>
                <td className="px-3 py-3">{classLabel(lang, r.geomClass)}</td>
                <td className="px-3 py-3">{r.gearClass ? classLabel(lang, r.gearClass) : "—"}</td>
                <td className="px-3 py-3 font-medium" style={{ color: CLASS_COLOR[r.cornerClass] }}>
                  {classLabel(lang, r.cornerClass)}
                </td>
                <td className="px-3 py-3 text-muted">{explainRow(lang, r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input
        className="h-11 w-24 rounded-xl border border-line bg-bg px-2 text-right font-mono text-fg"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function FileSlot({
  id,
  label,
  hint,
  readyLabel,
  ready,
  onFile,
}: {
  id: string;
  label: string;
  hint: string;
  readyLabel: string;
  ready: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-dashed border-line bg-surface px-3 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-muted">{ready ? readyLabel : hint}</span>
      <input
        id={id}
        className="sr-only"
        type="file"
        accept=".json,.csv,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function Count({
  label,
  value,
  other,
  aside,
  tone,
}: {
  label: string;
  value: number;
  other: number;
  aside: string;
  tone: "low" | "mid" | "high";
}) {
  const color = tone === "low" ? "text-low" : tone === "mid" ? "text-mid" : "text-high";
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <p className={`text-sm ${color}`}>{label}</p>
      <p className="font-mono text-2xl">{value}</p>
      <p className="text-sm text-muted">
        {aside} {other}
      </p>
    </div>
  );
}

function TrackMap({
  points,
  rows,
  selected,
  onSelect,
}: {
  points: { x: number; y: number }[];
  rows: CornerResult[];
  selected: string | null;
  onSelect: (label: string) => void;
}) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = 760;
  const h = 420;
  const pad = 36;
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const sy = (y: number) => h - pad - ((y - minY) / (maxY - minY || 1)) * (h - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      <path d={d} fill="none" stroke="var(--color-track)" strokeWidth="3" />
      {rows.map((r) => (
        <g key={r.label} onClick={() => onSelect(r.label)} className="cursor-pointer">
          <circle
            cx={sx(r.x)}
            cy={sy(r.y)}
            r={selected === r.label ? 8 : 5.5}
            fill={CLASS_COLOR[r.cornerClass]}
            stroke="var(--color-bg)"
          />
          <text x={sx(r.x) + 8} y={sy(r.y) - 8} fill="var(--color-fg)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
