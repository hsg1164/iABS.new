import type { IconName } from "./ui";

export interface Legend { n: string; lv: number; xp: number; h: number; a?: string }
export type ModeKey = "h" | "lv" | "xp";
export interface Mode {
  t: string; i: IconName; u: "h" | "";
  s: (a: Legend, b: Legend) => number;
  v: (d: Legend) => number;
}

/* ===== data (a = رابط صورة الأفاتار، اختياري) ===== */
const BASE: [string, number, number, number][] = [
  ["Jonej", 17, 32200, 43], ["ijnoo1", 12, 16200, 43], ["1Renoo", 11, 13500, 39], ["1Leen701", 19, 37600, 39],
  ["se_ba55", 16, 27100, 38], ["lDarin", 6, 4700, 37], ["Ashwaq3", 15, 24400, 36], ["aseelA6", 9, 9400, 36],
];
let seed = 21;
const R = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const SY = ["Na", "Fa", "Ra", "Ba", "Sa", "Ka", "Mo", "Za", "Li", "Da", "Nu", "Ha", "Ya", "Ta", "Ma", "Re", "Jo", "Ab", "Kh", "Wa"];
const EN = ["wf", "der", "ad", "an", "im", "een", "oor", "ah", "ed", "iq", "ar", "oo", "ex", "ia", "ar_7", "X", "99", "22", "_q", "1"];

export const xpl = (l: number) => l * l * 100;

export const DATA: Legend[] = BASE.map(([n, lv, xp, h]) => ({ n, lv, xp, h }));
while (DATA.length < 100) {
  const nm = SY[Math.floor(R() * SY.length)] + EN[Math.floor(R() * EN.length)] + (R() < 0.4 ? Math.floor(R() * 99) : "");
  if (DATA.some((d) => d.n === nm)) continue;
  const lv = 1 + Math.floor(Math.pow(R(), 1.3) * 19);
  const xp = Math.round(lv * lv * 100 + R() * (2 * lv + 1) * 100);
  const h = Math.max(2, Math.round(35 - DATA.length * 0.32 + R() * 3));
  DATA.push({ n: nm, lv, xp, h });
}

export const MODES: Record<ModeKey, Mode> = {
  h: { t: "الأكثر ساعات", i: "clk", u: "h", s: (a, b) => b.h - a.h || b.xp - a.xp, v: (d) => d.h },
  lv: { t: "الأعلى لفل", i: "star", u: "", s: (a, b) => b.lv - a.lv || b.xp - a.xp, v: (d) => d.lv },
  xp: { t: "الأكثر XP", i: "bolt", u: "", s: (a, b) => b.xp - a.xp, v: (d) => d.xp },
};
export const MODE_KEYS = Object.keys(MODES) as ModeKey[];

export const SORTED = Object.fromEntries(MODE_KEYS.map((k) => [k, [...DATA].sort(MODES[k].s)])) as Record<ModeKey, Legend[]>;
export const RANKS = Object.fromEntries(
  MODE_KEYS.map((k) => [k, new Map(SORTED[k].map((d, i) => [d.n, i + 1]))])
) as Record<ModeKey, Map<string, number>>;

export const tier = (l: number) =>
  l >= 20 ? { n: "أسطورة", c: "#ff2f3a" } : l >= 15 ? { n: "قائد", c: "#ff8a2b" } :
  l >= 10 ? { n: "فارس", c: "#b44cf0" } : l >= 5 ? { n: "محارب", c: "#e0a066" } : { n: "مبتدئ", c: "#9aa2ad" };

export const fx = (x: number) =>
  x >= 1e6 ? (x / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : x >= 1000 ? (x / 1000).toFixed(1) + "K" : String(x);

/** عرض وقت المشاهدة بشكل مفهوم: دقائق قبل الساعة، وساعات مختصرة بعدها. */
export const fh = (hours: number) => {
  const mins = Math.max(0, Math.round(hours * 60));
  if (mins < 60) return `${mins}د`;
  const h = mins / 60;
  return `${Number(h.toFixed(1))}س`;
};

export const prog = (d: Legend) => Math.min(1, (d.xp - xpl(d.lv)) / (xpl(d.lv + 1) - xpl(d.lv)));

export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
