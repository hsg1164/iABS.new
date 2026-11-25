import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { fx, hash, type Legend } from "./data";

export const cv = (o: Record<string, string | number>) => o as CSSProperties;

/* ===== أيقونات ===== */
export type IconName = "star" | "clk" | "bolt" | "users" | "crown" | "prev" | "next" | "x" | "cpy";
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
const S6 = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<IconName, JSX.Element> = {
  star: <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" />,
  clk: <><circle cx="12" cy="12" r="9" {...S} /><path d="M12 7v5l3 2" {...S} strokeLinecap="round" /></>,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" />,
  users: <><circle cx="9" cy="8" r="3.5" {...S} /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .7 3.2 2.4 3.5 5.2" {...S} strokeLinecap="round" /></>,
  crown: <path d="M3 18h18l1.5-11-5.5 4.5L12 4 7 11.5 1.5 7 3 18zm1 2h16v2H4z" fill="currentColor" />,
  prev: <path d="m9 5 7 7-7 7" {...S6} />,
  next: <path d="m15 5-7 7 7 7" {...S6} />,
  x: <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  cpy: <><rect x="9" y="9" width="12" height="12" rx="3" {...S} /><path d="M5 15V6a2 2 0 0 1 2-2h9" {...S} strokeLinecap="round" /></>,
};
export const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">{ICONS[name]}</svg>
);

/* ===== hooks ===== */
export function useReady() {
  const [ready, set] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => set(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, []);
  return ready;
}

export function useInView<T extends Element>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [seen, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { set(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/* ===== عدّاد متحرك ===== */
export function CountUp({ to, unit = "", active, as: Tag = "span" }: { to: number; unit?: "h" | "x" | ""; active: boolean; as?: "b" | "span" }) {
  const [text, setText] = useState("0");
  useEffect(() => {
    if (!active) return;
    let raf = 0, t0: number | null = null;
    const step = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / 1400), v = to * (1 - Math.pow(1 - p, 3));
      setText((unit === "x" ? fx(Math.round(v)) : Math.round(v).toLocaleString("en")) + (unit === "h" ? "h" : ""));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, to, unit]);
  return <Tag data-n={to}>{text}</Tag>;
}

/* ===== أفاتار + حلقة تقدّم + شريط ===== */
const AP = [["#ff8a8f", "#5a0a10"], ["#ffb06a", "#5a2a08"], ["#b58cff", "#2a1050"], ["#6bd6ff", "#0c2a40"], ["#7dffb0", "#0c3a22"], ["#ff6aa3", "#4a0c2a"], ["#ffd36a", "#4a3008"]];
export function Avatar({ d }: { d: Legend }) {
  const p = AP[hash(d.n) % AP.length];
  return <span className="av" style={cv({ "--a1": p[0], "--a2": p[1] })}>{d.a ? <img src={d.a} alt="" /> : (d.n[0] || "?").toUpperCase()}</span>;
}

export function Ring({ pct, r = 46 }: { pct: number; r?: number }) {
  const ready = useReady(), c = 2 * Math.PI * r;
  return (
    <svg className="rg" viewBox="0 0 100 100">
      <circle className="t" cx="50" cy="50" r={r} />
      <circle className="p" cx="50" cy="50" r={r} strokeDasharray={c.toFixed(1)} style={{ strokeDashoffset: (ready ? c * (1 - pct) : c).toFixed(1) }} />
    </svg>
  );
}

export function Bar({ pct }: { pct: number }) {
  const ready = useReady();
  return <div className="bar"><i style={{ width: `${ready ? pct : 0}%` }} /></div>;
}

/* ===== شارات ===== */
export function Hex({ l, c, className = "lv" }: { l: number; c: string; className?: string }) {
  const id = "h" + (hash(`${l}${c}`) % 999);
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor="#140808" /></linearGradient></defs>
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill={`url(#${id})`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
      <text x="20" y="25" textAnchor="middle" fontFamily="Changa,Tajawal,sans-serif" fontWeight="800" fontSize={l > 9 ? 15 : 18} fill="#fff">{l}</text>
    </svg>
  );
}

export const Medal = ({ c }: { c: string }) => (
  <svg className="medal" viewBox="0 0 48 48">
    <path d="M14 3h8l3 12h-8zM34 3h-8l-3 12h8z" fill={c} opacity=".6" />
    <circle cx="24" cy="30" r="14" fill={c} />
    <circle cx="24" cy="30" r="9.5" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2" />
    <path d="m24 23 2.3 4.7 5.2.8-3.8 3.6.9 5.1L24 34.8l-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" fill="rgba(0,0,0,.42)" />
  </svg>
);

export function Wreath() {
  const leaves: JSX.Element[] = [];
  for (let s = 0; s < 2; s++) {
    const items: JSX.Element[] = [];
    for (let i = 0; i < 9; i++) {
      const t = ((28 + i * 15) * Math.PI) / 180, x = 100 - 86 * Math.sin(t), y = 100 + 86 * Math.cos(t);
      const a = (Math.atan2(Math.cos(t), -Math.sin(t)) * 180) / Math.PI;
      [-38, 38].forEach((k) =>
        items.push(<ellipse key={`${i}${k}`} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="4.6" ry="12" transform={`rotate(${(a + k).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill="url(#lg)" opacity={(0.7 + i * 0.035).toFixed(2)} />)
      );
    }
    leaves.push(<g key={s} transform={s ? "translate(200 0) scale(-1 1)" : undefined}>{items}</g>);
  }
  return (
    <svg className="wr" viewBox="0 0 200 200">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset=".5" stopColor="#f0b23c" /><stop offset="1" stopColor="#9a5a10" /></linearGradient></defs>
      {leaves}
    </svg>
  );
}

export const Crown = () => (
  <svg className="crown" viewBox="0 0 64 64">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset=".55" stopColor="#f0b23c" /><stop offset="1" stopColor="#b86a14" /></linearGradient></defs>
    <path d="M8 46 4 18l16 12 12-20 12 20 16-12-4 28Z" fill="url(#cg)" stroke="#7a3d08" strokeWidth="2" strokeLinejoin="round" />
    <rect x="8" y="46" width="48" height="8" rx="3" fill="url(#cg)" stroke="#7a3d08" strokeWidth="2" />
    <circle cx="4" cy="17" r="3.5" fill="#ff2f3a" /><circle cx="32" cy="9" r="4" fill="#ff2f3a" />
    <circle cx="60" cy="17" r="3.5" fill="#ff2f3a" /><circle cx="32" cy="50" r="2.5" fill="#ffd5d7" />
  </svg>
);
