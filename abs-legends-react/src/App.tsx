import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyEvent } from "react";
import { createPortal } from "react-dom";
import { MODES, MODE_KEYS, fh, fx, prog, tier, xpl, type Legend, type ModeKey } from "./data";
import { Avatar, Bar, CountUp, Crown, Hex, Icon, Medal, Ring, Wreath, cv, useInView, type IconName } from "./ui";
import { fetchBotrixLeaderboard } from "../../utils/botrixApi";
import "./styles.css";

type LiveLegend = Legend & { name?: string; level?: number; watchtime?: number };
const emptyRank = () => new Map<string, number>();

/* ===== Toast + نسخ ===== */
function useToast() {
  const [state, setState] = useState({ msg: "", on: false });
  const timer = useRef<number>(0);
  const show = useCallback((msg: string) => {
    setState({ msg, on: true });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, on: false })), 1900);
  }, []);
  return { ...state, show };
}

function copyText(t: string, ok: string, toast: (m: string) => void) {
  const done = () => toast(ok);
  const fallback = () => {
    try {
      const a = document.createElement("textarea");
      a.value = t; a.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(a); a.select();
      const r = document.execCommand("copy");
      document.body.removeChild(a);
      r ? done() : toast("تعذّر النسخ");
    } catch { toast("تعذّر النسخ"); }
  };
  try { navigator.clipboard.writeText(t).then(done, fallback); } catch { fallback(); }
}

const onEnter = (fn: () => void) => (e: RKeyEvent) => { if (e.key === "Enter") fn(); };

/* ===== إحصائيات ===== */
const makeStats = (data: Legend[]): { i: IconName; v: number; l: string; u: "" | "h" | "x" }[] => [
  { i: "users", v: data.length, l: "أسطورة", u: "" },
  { i: "clk", v: data.reduce((a, d) => a + d.h, 0), l: "ساعة تفاعل", u: "h" },
  { i: "star", v: data.length ? Math.max(...data.map((d) => d.lv)) : 0, l: "أعلى لفل", u: "" },
  { i: "bolt", v: data.reduce((a, d) => a + d.xp, 0), l: "إجمالي XP", u: "x" },
];

function Stat({ s, i, parentSeen }: { s: (typeof STATS)[number]; i: number; parentSeen: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={"s4 cut rv" + (seen ? " in" : "")} style={cv({ "--d": `${i * 0.07}s` })}>
      <div className="ic"><Icon name={s.i} /></div>
      <div><CountUp as="b" to={s.v} unit={s.u} active={seen || parentSeen} /><span>{s.l}</span></div>
    </div>
  );
}

function Stats({ data }: { data: Legend[] }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={"stats4 rv" + (seen ? " in" : "")}>
      {makeStats(data).map((s, i) => <Stat key={s.l} s={s} i={i} parentSeen={seen} />)}
    </div>
  );
}

/* ===== منصّة التتويج ===== */
function Podium({ mode, data, sorted, onOpen }: { mode: ModeKey; data: Legend[]; sorted: Record<ModeKey, Legend[]>; onOpen: (n: string) => void }) {
  const M = MODES[mode], top = sorted[mode].slice(0, 3);
  const sparks = useMemo(
    () => Array.from({ length: 14 }, () => ({ l: 6 + Math.random() * 88, t: 18 + Math.random() * 60, d: Math.random() * 3 })),
    []
  );
  return (
    <>
      {sparks.map((s, i) => <i key={i} className="sp" style={{ left: `${s.l.toFixed(0)}%`, top: `${s.t.toFixed(0)}%`, animationDelay: `${s.d.toFixed(1)}s` }} />)}
      <div className="sh2">
        <div className="ic"><Icon name="star" /></div>
        <div><h3>قاعة الأساطير</h3><p>ترتيب حسب <b>{M.t.replace("الأكثر ", "").replace("الأعلى ", "")}</b></p></div>
        <span className="pil">{data.length} أسطورة</span>
      </div>
      <div className="pod3">
        {[1, 0, 2].map((ix) => {
          const d = top[ix], r = ix + 1, t = tier(d.lv), mc = ["", "#ffd36a", "#d9dde3", "#e0a066"][r];
          return (
            <div key={d.n} className={`pm r${r}`} style={cv({ "--tc": t.c })} tabIndex={0} role="button" onClick={() => onOpen(d.n)} onKeyDown={onEnter(() => onOpen(d.n))}>
              <div className="aw">
                {r === 1 && <><Wreath /><Crown /></>}
                <Ring pct={Math.max(0.05, prog(d))} /><Avatar d={d} />
                {r > 1 && <Medal c={mc} />}
              </div>
              <div className="nm">{d.n}</div>
              <span className="tchip"><Hex l={d.lv} c={t.c} className="" />{t.n}</span>
              <div className="mt">Lv.{d.lv} · {fx(d.xp)} XP{mode !== "h" ? ` · ${fh(d.h)}` : ""}</div>
              <div className="big"><CountUp to={M.v(d)} unit={M.u} active /></div>
              <div className="ped"><i>{r}</i></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ===== بطاقة أسطورة ===== */
function LegendCard({ d, i, mode, sorted, ranks, onOpen }: { d: Legend; i: number; mode: ModeKey; sorted: Record<ModeKey, Legend[]>; ranks: Record<ModeKey, Map<string, number>>; onOpen: (n: string) => void }) {
  const M = MODES[mode], t = tier(d.lv), rank = ranks[mode].get(d.n)!, mx = M.v(sorted[mode][0]);
  return (
    <article className="lc cut" tabIndex={0} role="button" style={cv({ "--tc": t.c, "--d": `${Math.min(i % 12, 11) * 0.04}s` })} onClick={() => onOpen(d.n)} onKeyDown={onEnter(() => onOpen(d.n))}>
      <span className="rk">{String(rank).padStart(2, "0")}</span>
      <div className="tp">
        <div className="aw"><Ring pct={Math.max(0.04, prog(d))} /><Avatar d={d} /><Hex l={d.lv} c={t.c} /></div>
        <div><h4>{d.n}</h4><span className="cl">{t.n}</span></div>
      </div>
      <div className="chs">
        <span className="cx">{fx(d.xp)} XP</span>
        <span className="ch">{fh(d.h)}</span>
        <span className="cx" style={{ color: "#fff", background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }}>Lv.{d.lv}</span>
      </div>
      <Bar pct={(M.v(d) / mx) * 100} />
    </article>
  );
}

/* ===== نافذة التفاصيل ===== */
function ModalBody({ d, ranks, onStep, onClose, onCopy }: { d: Legend; ranks: Record<ModeKey, Map<string, number>>; onStep: (n: number) => void; onClose: () => void; onCopy: (t: string) => void }) {
  const t = tier(d.lv), nx = xpl(d.lv + 1) - d.xp;
  const top3 = (r: number) => (r <= 3 ? "t3" : "");
  const rk = { h: ranks.h.get(d.n) ?? 0, lv: ranks.lv.get(d.n) ?? 0, xp: ranks.xp.get(d.n) ?? 0 };
  return (
    <>
      <div className="hd">
        <div className="nv">
          <button className="ib" aria-label="السابق" onClick={() => onStep(-1)}><Icon name="prev" /></button>
          <button className="ib" aria-label="التالي" onClick={() => onStep(1)}><Icon name="next" /></button>
          <button className="ib x" aria-label="إغلاق" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>
      <div className="mid">
        <div className="aw"><Ring pct={Math.max(0.04, prog(d))} /><Avatar d={d} /><Hex l={d.lv} c={t.c} /></div>
        <h3>{d.n}</h3>
        <span className="tchip" style={cv({ "--tc": t.c })}>{t.n}</span>
      </div>
      <div className="tiles">
        <div className="tl"><b>{d.lv}</b><span>المستوى</span></div>
        <div className="tl"><b>{fx(d.xp)}</b><span>XP</span></div>
        <div className="tl"><b>{fh(d.h)}</b><span>ساعات التفاعل</span></div>
      </div>
      <div className="nx">
        <div className="l"><span>التقدم للمستوى {d.lv + 1}</span><b>{fx(nx)} XP متبقي</b></div>
        <Bar pct={prog(d) * 100} />
      </div>
      <div className="rks">
        <span className={top3(rk.h)}>ساعات: #{rk.h}</span>
        <span className={top3(rk.lv)}>لفل: #{rk.lv}</span>
        <span className={top3(rk.xp)}>XP: #{rk.xp}</span>
      </div>
      <div className="mac"><button className="fbtn" onClick={() => onCopy(d.n)}><Icon name="cpy" />نسخ الاسم</button></div>
    </>
  );
}

/* ===== التطبيق ===== */
export default function App() {
  const [data, setData] = useState<Legend[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ModeKey>("h");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(12);
  const [cur, setCur] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const rows = await fetchBotrixLeaderboard(true);
        const mapped: Legend[] = rows.map((x: any) => ({ n: x.name, lv: Number(x.level) || 1, xp: Number(x.xp) || 0, h: Math.max(0, (Number(x.watchtime) || 0) / 3600) }));
        if (!dead) { setData(mapped); setLoading(false); }
        for (let i = 0; i < mapped.length; i += 8) {
          const batch = await Promise.all(mapped.slice(i, i + 8).map(async (p) => {
            try {
              const r = await fetch(`/api/kick?endpoint=${encodeURIComponent(`https://kick.com/api/v2/channels/${p.n}`)}`);
              const j = await r.json();
              return { n: p.n, a: j?.user?.profile_pic || "" };
            } catch { return { n: p.n, a: "" }; }
          }));
          if (dead) return;
          setData((prev) => prev.map((p) => { const hit = batch.find((x) => x.n.toLowerCase() === p.n.toLowerCase()); return hit?.a ? { ...p, a: hit.a } : p; }));
        }
      } catch { if (!dead) setLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => { dead = true; window.clearInterval(timer); };
  }, []);

  const [headRef, headSeen] = useInView<HTMLDivElement>();
  const [hallRef, hallSeen] = useInView<HTMLElement>();
  const [toolsRef, toolsSeen] = useInView<HTMLDivElement>();
  const segRef = useRef<HTMLDivElement>(null);
  const ovRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });

  const sorted = useMemo(() => Object.fromEntries(MODE_KEYS.map((k) => [k, [...data].sort(MODES[k].s)])) as Record<ModeKey, Legend[]>, [data]);
  const ranks = useMemo(() => Object.fromEntries(MODE_KEYS.map((k) => [k, new Map(sorted[k].map((d, i) => [d.n, i + 1]))])) as Record<ModeKey, Map<string, number>>, [sorted]);
  const sort = sorted[mode];
  const all = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? sort : sort.slice(3)).filter((d) => !s || d.n.toLowerCase().includes(s));
  }, [q, sort]);
  const vis = all.slice(0, shown);
  const curData = cur ? data.find((d) => d.n === cur) ?? null : null;

  const close = useCallback(() => setCur(null), []);
  const step = useCallback((dd: number) => {
    if (!cur) return;
    const i = sort.findIndex((x) => x.n === cur) + dd;
    if (i < 0 || i >= sort.length) return toast.show("نهاية القائمة");
    setCur(sort[i].n);
  }, [cur, sort, toast.show]); // eslint-disable-line react-hooks/exhaustive-deps

  /* مؤشّر التبويب المتحرك */
  const measure = useCallback(() => {
    const b = segRef.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (b) setInd({ left: b.offsetLeft, width: b.offsetWidth });
  }, []);
  useLayoutEffect(measure, [mode, measure]);
  useEffect(() => {
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    const t = setTimeout(measure, 400);
    return () => { removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);

  /* النافذة: قفل التمرير + الكيبورد */
  useEffect(() => {
    document.body.style.overflow = cur ? "hidden" : "";
    if (ovRef.current) ovRef.current.scrollTop = 0;
  }, [cur]);
  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(-1);
      if (e.key === "ArrowLeft") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cur, close, step]);

  const rv = (seen: boolean) => "rv" + (seen ? " in" : "");

  return (
    <>
      <main className="wrap">
        <div ref={headRef} className={"sh " + rv(headSeen)}>
          <span className="num">05</span>
          <div className="tx"><span className="tag">CHAT LEGENDS</span><h2>أساطير الشات</h2><p>الأكثر تفاعلاً في جميع البثوث.</p></div>
          <span className="ln" />
        </div>

        <Stats data={data} />

        <section ref={hallRef} className={"hall cut " + rv(hallSeen)}>
          {loading ? <div className="empty">جاري تحميل بيانات أساطير الشات…</div> : data.length < 3 ? <div className="empty">لا توجد بيانات كافية حالياً.</div> : <Podium key={mode} mode={mode} data={data} sorted={sorted} onOpen={setCur} />}
        </section>

        <div ref={toolsRef} className={"tools " + rv(toolsSeen)}>
          <div className="seg" ref={segRef}>
            <span className="ind" style={{ left: ind.left, width: ind.width }} />
            {MODE_KEYS.map((k) => (
              <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setShown(12); }}>
                <Icon name={MODES[k].i} />{MODES[k].t}
              </button>
            ))}
          </div>
          <label className="search cut">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="ابحث عن أسطورة بالاسم" aria-label="بحث" value={q} onChange={(e) => { setQ(e.target.value); setShown(12); }} />
          </label>
        </div>

        <section className="grid">
          {vis.length
            ? vis.map((d, i) => <LegendCard key={mode + d.n} d={d} i={i} mode={mode} sorted={sorted} ranks={ranks} onOpen={setCur} />)
            : <div className="empty">ما في أسطورة مطابقة للبحث.</div>}
        </section>

        <div className="more">
          <button className="sbtn" type="button" style={{ display: all.length > shown ? "" : "none" }} onClick={() => setShown((s) => s + 12)}>
            عرض المزيد ({Math.min(12, all.length - shown)})
          </button>
        </div>
      </main>

      {createPortal(
        <div ref={ovRef} className={"ov" + (curData ? " on" : "")} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="md cut" style={curData ? cv({ "--tc": tier(curData.lv).c }) : undefined}>
            {curData && <ModalBody key={curData.n} d={curData} ranks={ranks} onStep={step} onClose={close} onCopy={(t) => copyText(t, "تم نسخ الاسم", toast.show)} />}
          </div>
        </div>,
        document.body
      )}

      <div className={"toast" + (toast.on ? " on" : "")}>{toast.msg}</div>
    </>
  );
}
