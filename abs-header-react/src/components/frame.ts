export type Pt = [number, number];

export interface FrameInput { w: number; h: number; compact: boolean; open: boolean; prog: number }
export interface Frame {
  base: string; inner: string; tick: string; bracket: string; clip: string;
  nodes: Pt[]; pg: { x1: number; x2: number; y: number; on: boolean };
}

/** مضلع الإطار: قصّات مائلة + جيب تحت الشعار (على الشاشات العريضة) */
function polygon(w: number, h: number, c: number, s: number, pocket: boolean): Pt[] {
  const a: Pt[] = [[c, 0], [w - s, 0], [w, s], [w, h - c], [w - c, h]];
  if (pocket) a.push([w - 150, h], [w - 164, h - 8], [w - 300, h - 8], [w - 314, h]);
  a.push([s, h], [0, h - s], [0, c]);
  return a;
}
const toPath = (a: Pt[]) => "M" + a.map(q => q.join(" ")).join("L") + "Z";

export function buildFrame({ w, h, compact, open, prog }: FrameInput): Frame {
  const mob = w < 900;
  const c = mob ? 16 : compact ? 20 : 30;
  const s = mob ? 7 : compact ? 8 : 11;
  const pocket = w > 900 && !open;
  const a = polygon(w, h, c, s, pocket);
  const i = polygon(w - 12, h - 12, c, s, pocket).map(([x, y]): Pt => [x + 6, y + 6]);
  const len = Math.max(0, (w - 2 * c) * prog);
  return {
    base: toPath(a),
    inner: toPath(i),
    tick: `M${c + 14} 6H${w * 0.55}M${w * 0.62} ${h - 5}H${w * 0.8}`,
    bracket: `M${c + 2} 12V${c + 2}H${c + 12}M${w - s - 12} ${h - 4}H${w - s - 2}V${h - 12}`,
    clip: "polygon(" + a.map(q => `${q[0]}px ${q[1]}px`).join(",") + ")",
    nodes: [[c, 0], [w, s], [w - c, h], [0, h - s]],
    pg: { x1: w - c, x2: w - c - len, y: h - 1, on: prog > 0.003 },
  };
}
