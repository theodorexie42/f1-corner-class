import type { CornerClass, CornerResult } from "@/lib/corner-class";

export type Lang = "zh" | "en";

export const RACE_NAME: Record<string, { zh: string; en: string }> = {
  r01: { zh: "澳大利亚", en: "Australia" },
  r02: { zh: "中国", en: "China" },
  r03: { zh: "日本", en: "Japan" },
  r04: { zh: "迈阿密", en: "Miami" },
  r05: { zh: "加拿大", en: "Canada" },
  r06: { zh: "摩纳哥", en: "Monaco" },
  r07: { zh: "巴塞罗那", en: "Barcelona" },
  r08: { zh: "奥地利", en: "Austria" },
  r09: { zh: "英国", en: "Britain" },
  r10: { zh: "比利时", en: "Belgium" },
  r11: { zh: "匈牙利", en: "Hungary" },
  r12: { zh: "荷兰", en: "Netherlands" },
  r13: { zh: "意大利", en: "Italy" },
  r14: { zh: "马德里", en: "Madrid" },
  r15: { zh: "阿塞拜疆", en: "Azerbaijan" },
  r16: { zh: "雪邦", en: "Sepang" },
  r17: { zh: "新加坡", en: "Singapore" },
};

const SOURCE_EN: Record<string, string> = {
  "f1.com 赛道图 + f1livedata 正赛最快圈": "Official F1 map + fastest race lap from f1livedata",
  "f1.com 赛道图。速度和挡位来自 F1 DataStop 正赛最快圈（VER 第55圈），f1livedata 没有这场车数据":
    "Official F1 map. Speed and gear are VER lap 55 from F1 DataStop. f1livedata has no car data for this race.",
};

export const copy = {
  zh: {
    language: "语言",
    kicker: "几何 + 最快圈速度 + 挡位",
    title: "弯型",
    intro:
      "选一场 2026 正赛。赛道图用 F1 官网的官方图，半径和转角沿这条赛道的中心线量。速度和挡位是这场正赛最快圈的曲线。三样各投一票，两票相同才定低速、中速或高速。",
    round: "2026 分站",
    usingUpload: "正在用上传的文件",
    trackMap: "赛道图",
    trackHint: "jpg、png、webp，或坐标 JSON / CSV",
    speedFile: "最快圈速度",
    speedHint: "速度曲线截图，或 distance,speed 表格",
    needSpeed: "还差速度曲线",
    needMap: "还差赛道图",
    lapLength: "圈长（米）",
    vmin: "速度图下沿 km/h",
    vmax: "速度图上沿 km/h",
    scaleHint: "截图读不出刻度。默认一圈 5300 米，纵轴 0 到 350。和你的图不一致就改这三个数。",
    geomWeight: "几何权重",
    geomHint: "0% 只看速度和挡位。拉高以后，急弯、小半径会按几何票把“跑得不慢”的弯从高速里拉出来。",
    shortcuts: "快捷键",
    shortcutHint: "点右侧按键，再按一个新键。正在输入时不会触发。Esc 取消。",
    actZh: "中文",
    actEn: "English",
    actPrev: "上一站",
    actNext: "下一站",
    actDownload: "下载表格",
    pressKey: "按键…",
    shortcutTaken: "这个键已经用了",
    shortcutReset: "恢复默认",
    download: "下载这张表",
    speedOnly: "只看速度",
    officialMap: "F1 官网赛道图",
    officialEmpty: "官方赛道图会显示在这里。",
    centerline: "中心线，点是综合弯型",
    pickOrUpload: "选择分站，或上传赛道图。",
    speedEmpty: "速度曲线会画在这里。",
    gearEmpty: "这一站没有挡位曲线。",
    speedTip: "速度",
    gearTip: "挡位",
    loadedSwap: "已载入，可换一份",
    loading: "载入中",
    uploadedTrack: "上传的赛道",
    mapFallback: "赛道图",
    customSpeed: "自定义速度曲线",
    noSpeed: "还没有速度曲线",
    agree: "一致",
    mapAlt: "官方赛道图",
    colCorner: "弯",
    colRadius: "半径 m",
    colHeading: "转角 °",
    colMinSpeed: "最低速度",
    colMinGear: "最低挡",
    colSpeed: "速度",
    colGeom: "几何",
    colGear: "挡位",
    colCombined: "综合",
    colNote: "说明",
    low: "低速",
    medium: "中速",
    high: "高速",
    "err.index": "内置分站暂时读不到，可以直接上传赛道图和速度曲线。",
    "err.race": "这一站的赛道或速度曲线没有载入。",
    "busy.track": "正在从赛道图描中心线",
    "busy.speed": "正在从速度图描曲线",
    "err.canvas": "浏览器画布不可用",
    "err.imageOpen": "这张图打不开，请换 jpg、png 或 webp",
    "err.noCenterline": "没能从这张赛道图描出闭合中心线。请用线条清楚、背景干净的俯视图。",
    "err.noAxes": "速度图里找不到坐标轴",
    "err.noSpeedTrace": "没能从速度图里抽出曲线。请用单条、对比清楚的速度曲线截图。",
    "err.mapEmpty": "赛道图是空的",
    "err.mapPoints": "赛道图至少需要 8 个坐标点，两列分别是 x 和 y",
    "err.mapPointsShort": "赛道图至少需要 8 个点",
    "err.mapFormat": "赛道图格式无法识别",
    "err.mapXY": "赛道图需要 x、y 两条坐标",
    "err.mapNaN": "坐标里有非数字",
    "err.speedEmpty": "速度曲线是空的",
    "err.speedArray": "速度文件需要是数组，或带 speed 数组",
    "err.speedRows": "速度曲线至少需要 4 行。列是 distance_m,speed_kmh，或 time_s,speed_kmh",
    "err.generic": "读不了这个文件",
  },
  en: {
    language: "Language",
    kicker: "Geometry + fastest lap + gear",
    title: "Corner class",
    intro:
      "Pick a 2026 race. The map is the official F1 circuit map. Radius and heading are measured along the centerline. Speed and gear come from that race’s fastest lap. Each of the three casts a vote, and two votes set the corner as low, medium, or high speed.",
    round: "2026 round",
    usingUpload: "Using an uploaded file",
    trackMap: "Track map",
    trackHint: "jpg, png, webp, or x/y JSON / CSV",
    speedFile: "Fastest-lap speed",
    speedHint: "Speed-trace screenshot, or a distance,speed table",
    needSpeed: "Speed trace still needed",
    needMap: "Track map still needed",
    lapLength: "Lap length (m)",
    vmin: "Chart bottom, km/h",
    vmax: "Chart top, km/h",
    scaleHint: "A screenshot has no scale. Defaults are 5,300 m per lap and 0–350 km/h. Change these three if your image differs.",
    geomWeight: "Geometry weight",
    geomHint: "0% uses speed and gear only. Raise it and a tight radius can pull a quick corner out of the high-speed class.",
    shortcuts: "Shortcuts",
    shortcutHint: "Click a key, then press a new one. Ignored while typing. Esc cancels.",
    actZh: "Chinese",
    actEn: "English",
    actPrev: "Previous round",
    actNext: "Next round",
    actDownload: "Download table",
    pressKey: "Press…",
    shortcutTaken: "That key is already used",
    shortcutReset: "Reset",
    download: "Download this table",
    speedOnly: "Speed only",
    officialMap: "Official F1 map",
    officialEmpty: "The official map appears here.",
    centerline: "Centerline. Dots are the combined class.",
    pickOrUpload: "Pick a round, or upload a map.",
    speedEmpty: "The speed trace is drawn here.",
    gearEmpty: "This round has no gear trace.",
    speedTip: "Speed",
    gearTip: "Gear",
    loadedSwap: "Loaded. Choose another file.",
    loading: "Loading",
    uploadedTrack: "Uploaded track",
    mapFallback: "Track map",
    customSpeed: "Custom speed trace",
    noSpeed: "No speed trace yet",
    agree: "Agree",
    mapAlt: "official circuit map",
    colCorner: "Corner",
    colRadius: "Radius m",
    colHeading: "Heading °",
    colMinSpeed: "Min speed",
    colMinGear: "Min gear",
    colSpeed: "Speed",
    colGeom: "Geometry",
    colGear: "Gear",
    colCombined: "Combined",
    colNote: "Note",
    low: "Low",
    medium: "Mid",
    high: "High",
    "err.index": "Built-in rounds could not be read. You can still upload a map and a speed trace.",
    "err.race": "This round’s map or speed trace did not load.",
    "busy.track": "Tracing the centerline from the map",
    "busy.speed": "Tracing the curve from the speed chart",
    "err.canvas": "The browser canvas is not available",
    "err.imageOpen": "This image could not be opened. Use jpg, png, or webp.",
    "err.noCenterline": "No closed centerline found. Use a clear overhead map with a clean background.",
    "err.noAxes": "No axes found in the speed chart",
    "err.noSpeedTrace": "No curve found. Use a screenshot with one clear speed trace.",
    "err.mapEmpty": "The map file is empty",
    "err.mapPoints": "The map needs at least 8 points, in two columns: x and y",
    "err.mapPointsShort": "The map needs at least 8 points",
    "err.mapFormat": "Map format not recognized",
    "err.mapXY": "The map needs both x and y coordinates",
    "err.mapNaN": "A coordinate is not a number",
    "err.speedEmpty": "The speed file is empty",
    "err.speedArray": "The speed file must be an array, or an object with a speed array",
    "err.speedRows": "The speed trace needs at least 4 rows: distance_m,speed_kmh or time_s,speed_kmh",
    "err.generic": "This file could not be read",
  },
} as const;

export type CopyKey = keyof (typeof copy)["zh"];

export function text(lang: Lang, key: CopyKey): string {
  return copy[lang][key];
}

export function classLabel(lang: Lang, c: CornerClass): string {
  return copy[lang][c];
}

export function raceName(lang: Lang, id: string, fallback: string): string {
  return RACE_NAME[id]?.[lang] ?? fallback;
}

export function formatRef(lang: Lang, ref: string): string {
  if (lang === "zh") return ref;
  return ref.replace(/第(\d+)圈/g, "lap $1");
}

export function formatSource(lang: Lang, source: string): string {
  if (lang === "zh") return source;
  return SOURCE_EN[source] ?? source;
}

export function explainRow(lang: Lang, r: CornerResult): string {
  if (!r.disagree) return copy[lang].agree;
  const label = (c: CornerClass) => classLabel(lang, c);
  const bits =
    lang === "zh"
      ? [`速度${label(r.speedClass)}`]
      : [`speed ${label(r.speedClass)}`];
  if (r.geomClass) bits.push(lang === "zh" ? `几何${label(r.geomClass)}` : `geometry ${label(r.geomClass)}`);
  if (r.gearClass) bits.push(lang === "zh" ? `${r.minGear}挡、${label(r.gearClass)}` : `gear ${r.minGear}, ${label(r.gearClass)}`);
  const joined = bits.join(lang === "zh" ? "，" : "; ");
  if (r.gearClass === "low" && r.speedClass === "high") {
    return lang === "zh" ? `${joined}。最低挡不超过 3，不记成高速弯` : `${joined}. Gear 3 or lower, so this is not a high-speed corner.`;
  }
  if (r.speedClass !== r.cornerClass) {
    return lang === "zh" ? `${joined}。综合记成${label(r.cornerClass)}` : `${joined}. Combined call is ${label(r.cornerClass)}.`;
  }
  return joined;
}

export function translateError(lang: Lang, message: string): string {
  if (message in copy.zh) return copy[lang][message as CopyKey];
  return message;
}
