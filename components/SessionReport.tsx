import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './SessionReport.css';
import { Language } from '../types';
import { kickFetch } from '../utils/kickApi';

/* ============================================================
   ABS Session Report — «تقرير الجلسة الأخيرة»
   Design: exact port of iABS-session-report (3).html (v4 rounded).
   Data: 100% real — latest Kick VODs + clips via /api/kick proxy,
   playback is real HLS straight from Kick's public servers.
   ============================================================ */

const LOGO = 'https://files.kick.com/images/user/1106194/profile_image/conversion/140c7236-24f9-4267-b318-6be659f6035e-fullsize.webp';
const CATIMG: Record<string, string> = {
    'Just Chatting': 'https://files.kick.com/images/subcategories/15/banner/5546d68b-e9f9-49f9-a658-9d2ece637064',
};
const CPAL = ['#ff2f3a', '#6b78ff', '#ffd23f', '#3dff7a', '#ff8a3d', '#c06bff'];
const hue = (n: string) => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return h % 360; };

interface Cat { n: string; img: string }
interface Sess {
    id: number; t: string; ts: number; min: number; sec: number; v: number; pk: number;
    cats: Cat[]; tags: string[]; uuid: string; src: string; thumb: string; h: number; sub: boolean;
}
interface Clip {
    id: string; t: string; by: string; v: number; ts: number; dur: number; at: number;
    vodId: number; src: string; thumb: string; h: number;
}

function mapSess(res: any): Sess[] {
    const d = res?.data ?? res;
    const arr: any[] = Array.isArray(d) ? d : (d?.videos || d?.data || []);
    return arr
        .filter(x => x && x.source && x.video?.status !== 'private' && !x.video?.is_pruned)
        .map(x => {
            const rawCats: any[] = x.categories || [];
            const cats: Cat[] = rawCats
                .map(c => ({ n: c?.name || c?.category?.name || '', img: c?.banner?.url || c?.banner?.responsive || c?.category?.banner?.url || '' }))
                .filter(c => c.n);
            const tags = Array.from(new Set([x.language, ...(rawCats[0]?.tags || [])].filter(Boolean))) as string[];
            const ts = Date.parse((x.created_at || '').replace(' ', 'T') + 'Z') || 0;
            return {
                id: x.id, t: x.session_title || 'بث بدون عنوان', ts,
                min: Math.round((x.duration || 0) / 60000), sec: Math.round((x.duration || 0) / 1000),
                v: x.views || x.video?.views || 0, pk: x.viewer_count || 0,
                cats: cats.length ? cats : [{ n: 'Just Chatting', img: '' }],
                tags, uuid: x.video?.uuid || x.slug || String(x.id),
                src: x.source, thumb: x.thumbnail?.src || '', h: (x.id * 47) % 360,
                sub: Boolean(x.subscriber_only || x.video?.subscriber_only),
            };
        })
        .sort((a, b) => b.ts - a.ts);
}

function mapClips(res: any): Clip[] {
    const d = res?.data ?? res;
    const arr: any[] = d?.clips || (Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []));
    return arr
        .filter(x => x && (x.clip_url || x.video_url))
        .map(x => {
            let h = 0; const s = String(x.id);
            for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
            return {
                id: s, t: (x.title || '').trim() || 'لقطة بدون عنوان', by: x.creator?.username || 'مشاهد',
                v: x.view_count ?? x.views ?? 0, ts: Date.parse(x.created_at) || 0,
                dur: Math.round(x.duration || 0), at: x.vod_starts_at > 0 ? x.vod_starts_at : 0,
                vodId: Number(x.livestream_id) || 0, src: x.clip_url || x.video_url,
                thumb: x.thumbnail_url || '', h: (h * 47) % 360,
            };
        })
        .sort((a, b) => b.ts - a.ts);
}

const fmt = (n: number) => Math.round(n).toLocaleString('en');
const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const hms = (s: number) => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};
const durTxt = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
const vphOf = (s: Sess) => Math.round(s.v / Math.max(s.min / 60, 1 / 60));

/* ---------- icons ---------- */
const ICO: Record<string, React.ReactNode> = {
    play: <path d="M8 5v14l11-7z" fill="currentColor" />,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></>,
    arr: <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" />,
    fire: <path d="M12 2c1 4-4 6-4 11a4.5 4.5 0 0 0 9 0c0-2-1-3.5-2-4.5 0 1.5-1 2.5-2 2.5.5-3-.5-7-1-9z" fill="currentColor" />,
    eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
    clk: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    cpy: <><rect x="9" y="9" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    shr: <><circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M8.4 10.8l7.2-4.2M8.4 13.2l7.2 4.2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />,
    back: <path d="M11 19l-7-7 7-7M20 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
    fwd: <path d="M13 5l7 7-7 7M4 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
    vol: <><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    mute: <><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    fs: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
};
const Ico: React.FC<{ k: string }> = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICO[k]}</svg>;

/* ---------- reveal-on-scroll ---------- */
function useInView<T extends HTMLElement>(threshold = 0.12) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setInView(true); io.disconnect(); }
        }, { threshold });
        io.observe(el);
        return () => io.disconnect();
    }, [threshold]);
    return { ref, inView };
}

const Rv: React.FC<{ className?: string; delay?: number; children: React.ReactNode }> = ({ className = '', delay = 0, children }) => {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className={`rv ${inView ? 'in' : ''} ${className}`} style={{ ['--d' as string]: `${delay}s` }}>
            {children}
        </div>
    );
};

/* ---------- count-up ---------- */
const Num: React.FC<{ value: number; s?: string }> = ({ value, s = '' }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const shown = useRef(0);
    const raf = useRef(0);
    const { ref: ioRef, inView } = useInView<HTMLSpanElement>();
    const setRefs = (el: HTMLSpanElement | null) => { (ref as React.MutableRefObject<HTMLSpanElement | null>).current = el; (ioRef as React.MutableRefObject<HTMLSpanElement | null>).current = el; };
    useEffect(() => {
        const el = ref.current;
        if (!el || !inView) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            shown.current = value; el.textContent = Math.round(value).toLocaleString('en') + s; return;
        }
        const from = shown.current, to = value, t0 = performance.now();
        cancelAnimationFrame(raf.current);
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / 1500);
            const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
            shown.current = v;
            el.textContent = Math.round(v).toLocaleString('en') + s;
            if (p < 1) raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf.current);
    }, [inView, value, s]);
    return <span ref={setRefs} data-n={value} dir="ltr">{(0).toLocaleString('en') + s}</span>;
};

/* ---------- segmented control ---------- */
interface SegOpt { id: string; label: string }
const Seg: React.FC<{ opts: SegOpt[]; value: string; onChange: (v: string) => void; label?: string }> = ({ opts, value, onChange, label }) => {
    const ref = useRef<HTMLDivElement>(null);
    const place = useCallback(() => {
        const sg = ref.current;
        if (!sg) return;
        const b = sg.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
        const ind = sg.querySelector<HTMLElement>('.ind');
        if (!b || !ind) return;
        ind.style.left = `${b.offsetLeft}px`;
        ind.style.width = `${b.offsetWidth}px`;
    }, []);
    useEffect(() => {
        place();
        window.addEventListener('resize', place);
        const t = setTimeout(place, 400);
        if (document.fonts?.ready) document.fonts.ready.then(place);
        return () => { window.removeEventListener('resize', place); clearTimeout(t); };
    }, [place, value, opts]);
    return (
        <div className="seg" ref={ref} role="group" aria-label={label}>
            <span className="ind" />
            {opts.map(o => (
                <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
            ))}
        </div>
    );
};

/* ---------- CTA pill ---------- */
const Cta: React.FC<{ pc?: string; icon?: string; title: string; sub?: string; onClick: () => void }> = ({ pc = '#ff2f3a', icon = 'play', title, sub, onClick }) => (
    <span className="ctaw" style={{ ['--pc' as string]: pc }}>
        <button className="cta" onClick={onClick}>
            <span className="fl" />
            <span className="ci"><Ico k={icon} /></span>
            <span className="ct"><b>{title}</b>{sub && <small>{sub}</small>}</span>
            <span className="ca"><Ico k="arr" /></span>
        </button>
    </span>
);

/* ---------- animated fills ---------- */
const Grow: React.FC<{ w: number; sc?: string; title?: string }> = ({ w, sc, title }) => {
    const { ref, inView } = useInView<HTMLElement>(0.2);
    return <i ref={ref} title={title} style={{ width: inView ? `${w}%` : 0, ...(sc ? { ['--sc' as string]: sc } : {}) }} />;
};

const CIRC = 163.4;
const Ring: React.FC<{ ratio: number; icon: string }> = ({ ratio, icon }) => {
    const { ref, inView } = useInView<HTMLDivElement>(0.2);
    const off = CIRC * (1 - Math.max(.04, Math.min(1, ratio)));
    return (
        <div className="rg" ref={ref}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle className="t" cx="32" cy="32" r="26" />
                <circle className="p" cx="32" cy="32" r="26" style={{ strokeDashoffset: inView ? off : CIRC }} />
            </svg>
            <i><Ico k={icon} /></i>
        </div>
    );
};

/* ---------- estimated viewers series (seeded, labeled as estimate) ---------- */
const N = 57;
function series(s: Sess): { cum: number[]; rate: number[] } {
    let seed = (s.t.length * 13 + s.v) % 233280;
    const raw: number[] = [];
    for (let i = 0; i < N; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        const x = seed / 233280;
        const sh = .55 + .45 * Math.sin(i / N * Math.PI * 1.6 + .4);
        raw.push(Math.max(.08, sh * (.4 + x)));
    }
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    const v = Math.max(s.v, 1);
    const per = 60 / Math.max(s.min / (N - 1), 1 / 60);
    let acc = 0;
    const cum = raw.map(r => (acc += r) / sum * v);
    const rate = raw.map(r => r / sum * v * per);
    return { cum, rate };
}

/* ---------- viewers curve panel ---------- */
const ChartPanel: React.FC<{
    s: Sess; clips: Clip[]; jump: { f: number; n: number } | null;
    onClip: (c: Clip) => void; L: (a: string, e: string) => string;
}> = ({ s, clips, jump, onClip, L }) => {
    const [mode, setMode] = useState('cum');
    const [rng, setRng] = useState('all');
    const [hov, setHov] = useState<{ pos: number; tt: number; v: number; y: number } | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const SER = useMemo(() => series(s), [s]);
    const minutes = Math.max(s.min, 1);

    const [i0, i1] = rng === 'a' ? [0, Math.floor((N - 1) / 2)] : rng === 'b' ? [Math.floor((N - 1) / 2), N - 1] : [0, N - 1];
    const lo = i0 / (N - 1), hi = i1 / (N - 1);
    const arr = SER[mode as 'cum' | 'rate'].slice(i0, i1 + 1);
    const mx = Math.max(...arr) * 1.1 || 1;
    const X = (i: number) => 100 - ((i - i0) / (i1 - i0)) * 100;
    const Y = (v: number) => 94 - (v / mx) * 84;
    const pts = arr.map((v, k) => `${X(i0 + k).toFixed(2)},${Y(v).toFixed(2)}`).join(' ');

    let pi = 0;
    SER.rate.forEach((v, i) => { if (v > SER.rate[pi]) pi = i; });

    const marks = clips.map((c, k) => {
        const f = c.at > 0 && s.sec > 0 ? Math.min(c.at / s.sec, 1) : (k + 1) / (clips.length + 1);
        return { c, k, i: Math.round(f * (N - 1)) };
    }).filter(m => m.i >= i0 && m.i <= i1);

    const showAt = useCallback((frac: number) => {
        const tt = Math.min(hi, Math.max(lo, frac));
        const ix = Math.min(N - 1, Math.max(0, Math.round(tt * (N - 1))));
        const v = SER[mode as 'cum' | 'rate'][ix];
        setHov({ pos: (tt - lo) / (hi - lo), tt, v, y: Y(v) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [SER, mode, lo, hi, mx]);

    useEffect(() => { setHov(null); }, [s.id, rng, mode]);
    useEffect(() => {
        if (!jump) return;
        showAt(jump.f);
        chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [jump, showAt]);

    const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const rtl = document.documentElement.dir !== 'ltr';
        let f = (e.clientX - r.left) / r.width;
        if (rtl) f = 1 - f;
        showAt(lo + Math.min(1, Math.max(0, f)) * (hi - lo));
    };

    const moments = useMemo(() => {
        const list: { t: number; label: string }[] = [
            { t: 0, label: L('بداية البث', 'Stream start') },
            ...clips.map((c, k) => ({
                t: c.at > 0 && s.sec > 0 ? Math.min(c.at / s.sec, 1) * minutes : (k + 1) / (clips.length + 1) * minutes,
                label: `${L('لقطة', 'Clip')} ${k + 1} · ${c.t.length > 26 ? c.t.slice(0, 26) + '…' : c.t}`,
            })),
            { t: pi / (N - 1) * minutes, label: L('ذروة المشاهدة', 'Peak viewership') },
            { t: minutes, label: L('نهاية البث', 'Stream end') },
        ];
        return list.sort((a, b) => a.t - b.t);
    }, [clips, s.sec, minutes, pi, L]);

    return (
        <>
            <div className="phd">
                <h2>{L('منحنى المشاهدات خلال البث', 'Viewership during the stream')}</h2>
                <small>{L('تقديري · مرّر أو المس المنحنى', 'Estimated · hover or touch the curve')}</small>
                <span className="sw">
                    <Seg label={L('نمط المنحنى', 'Curve mode')} value={mode} onChange={setMode} opts={[
                        { id: 'cum', label: L('تراكمي', 'Cumulative') },
                        { id: 'rate', label: L('لكل ساعة', 'Per hour') },
                    ]} />
                    <Seg label={L('النطاق', 'Range')} value={rng} onChange={setRng} opts={[
                        { id: 'all', label: L('الكل', 'All') },
                        { id: 'a', label: L('النصف الأول', 'First half') },
                        { id: 'b', label: L('النصف الثاني', 'Second half') },
                    ]} />
                </span>
            </div>
            <div ref={chartRef} className={`chart ${hov ? 'on' : ''}`} onPointerMove={scrub} onPointerDown={scrub} onPointerLeave={() => setHov(null)}>
                {[20, 40, 60, 80].map(p => <span key={p} className="gl" style={{ top: `${p}%` }} />)}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id={`absr-g${s.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#ff2f3a" stopOpacity=".55" />
                            <stop offset="1" stopColor="#ff2f3a" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`100,100 ${pts} 0,100`} fill={`url(#absr-g${s.id})`} />
                    <polyline points={pts} fill="none" stroke="#ff6a72" strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
                {pi >= i0 && pi <= i1 && <span className="pk" style={{ insetInlineStart: `${100 - X(pi)}%`, top: `${Y(SER[mode as 'cum' | 'rate'][pi])}%` }} />}
                {marks.map(m => (
                    <button key={m.c.id} className="mk" style={{ insetInlineStart: `${100 - X(m.i)}%`, top: `${Y(SER[mode as 'cum' | 'rate'][m.i])}%` }}
                        title={m.c.t} aria-label={`${L('لقطة', 'Clip')} ${m.k + 1}: ${m.c.t}`}
                        onClick={e => { e.stopPropagation(); onClip(m.c); }}>{m.k + 1}</button>
                ))}
                <span className="cur" style={{ insetInlineStart: `${(hov?.pos || 0) * 100}%` }}>
                    <i style={{ top: `${hov?.y || 0}%` }} />
                </span>
                <span className="tip" style={{ insetInlineStart: `${Math.min(90, Math.max(10, (hov?.pos || 0) * 100))}%` }}>
                    {hov && <><b>{hm(hov.tt * minutes)}</b> · {fmt(hov.v)}{mode === 'cum' ? L(' مشاهدة', ' views') : L(' / ساعة', ' / hr')}</>}
                </span>
            </div>
            <div className="ax">
                {[0, .25, .5, .75, 1].map(f => <span key={f}>{hm((i0 + (i1 - i0) * f) / (N - 1) * minutes)}</span>)}
            </div>
            <div className="tl">
                {moments.map((m, i) => (
                    <button key={i} className="cut" onClick={() => showAt(m.t / minutes)}>
                        <b>{hm(m.t)}</b>{m.label}
                    </button>
                ))}
            </div>
        </>
    );
};

/* ---------- sessions ladder ---------- */
const LadderPanel: React.FC<{
    sessions: Sess[]; cur: number; onPick: (i: number) => void;
    dateShort: (ts: number) => string; L: (a: string, e: string) => string;
}> = ({ sessions, cur, onPick, dateShort, L }) => {
    const [met, setMet] = useState('v');
    const [avgPos, setAvgPos] = useState<number | null>(null);
    const ldRef = useRef<HTMLDivElement>(null);
    const vals = sessions.map(s => met === 'v' ? s.v : s.min);
    const mx = Math.max(...vals, 1);
    const av = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);

    const place = useCallback(() => {
        const ld = ldRef.current;
        if (!ld) return;
        const tr = ld.querySelector<HTMLElement>('.lr .tr');
        if (!tr) return;
        const lr = ld.getBoundingClientRect(), rr = tr.getBoundingClientRect();
        const rtl = document.documentElement.dir !== 'ltr';
        const edge = rtl ? lr.right - rr.right : rr.left - lr.left;
        setAvgPos(edge + rr.width * (av / mx));
    }, [av, mx]);
    useLayoutEffect(() => {
        place();
        window.addEventListener('resize', place);
        const t = setTimeout(place, 400);
        if (document.fonts?.ready) document.fonts.ready.then(place);
        return () => { window.removeEventListener('resize', place); clearTimeout(t); };
    }, [place, met, sessions]);

    const s = sessions[cur];
    const val = vals[cur] || 0;
    const pct = av > 0 ? Math.round((val - av) / av * 100) : 0;

    return (
        <>
            <div className="phd">
                <h2>{L('سلم الجلسات', 'Sessions ladder')}</h2>
                <small>{L('اضغط على أي جلسة لعرض تقريرها', 'Tap any session to view its report')}</small>
                <span className="sw">
                    <Seg label={L('المقياس', 'Metric')} value={met} onChange={setMet} opts={[
                        { id: 'v', label: L('المشاهدات', 'Views') },
                        { id: 'min', label: L('المدة', 'Duration') },
                    ]} />
                </span>
            </div>
            <div className="ld" ref={ldRef}>
                {sessions.map((x, i) => (
                    <button key={x.id} className={`lr ${i === cur ? 'on' : ''}`} onClick={() => onPick(i)} aria-pressed={i === cur}>
                        <span>{dateShort(x.ts)}</span>
                        <span className="tr"><Grow w={vals[i] / mx * 100} /></span>
                        <b dir={met === 'min' ? 'ltr' : undefined}>{met === 'v' ? fmt(vals[i]) : durTxt(x.min)}</b>
                    </button>
                ))}
                {avgPos !== null && (
                    <span className="avg" style={{ insetInlineStart: `${avgPos}px` }}>
                        <span>{L('المعدل', 'Avg')}</span>
                    </span>
                )}
            </div>
            {s && (
                <div className="info">
                    <b>{s.t}</b>
                    {met === 'v' ? `${fmt(val)} ${L('مشاهدة', 'views')}` : durTxt(s.min)}
                    {' · '}{pct === 0 ? L('على معدل الجلسات تمامًا', 'right at the sessions average') :
                        `${pct > 0 ? L('أعلى', 'above') : L('أقل', 'below')} ${L('من معدل الجلسات بـ', 'the sessions average by')} ${Math.abs(pct)}%`}
                </div>
            )}
        </>
    );
};

/* ---------- categories & tags ---------- */
const CatPanel: React.FC<{ s: Sess; sessions: Sess[]; clipCount: number; L: (a: string, e: string) => string }> = ({ s, sessions, clipCount, L }) => {
    const cats = s.cats;
    const w = 100 / Math.max(cats.length, 1);
    const maxV = Math.max(...sessions.map(x => x.v), 0);
    return (
        <>
            <div className="phd"><h2>{L('الفئات والوسوم', 'Categories & tags')}</h2></div>
            <div className="cat">
                <div className="sb" aria-hidden="true">
                    {cats.map((c, i) => <Grow key={c.n} w={w} sc={CPAL[i % CPAL.length]} title={c.n} />)}
                </div>
                <div className="cgl">
                    {cats.map((c, i) => {
                        const col = CPAL[i % CPAL.length];
                        const img = c.img || CATIMG[c.n] || '';
                        return (
                            <div key={c.n} className="cgt" style={{ ['--pc' as string]: col, ['--ch' as string]: hue(c.n) }}>
                                <div className="bgf" />
                                <span className="ini" aria-hidden="true">{c.n.charAt(0)}</span>
                                {img && <img src={img} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                <span className="pcn">{Math.round(w)}%</span>
                                <span className="cn"><b>{c.n}</b>{cats.length === 1 && <small dir="ltr">{durTxt(s.min)}</small>}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="tg">{s.tags.map(t => <span key={t}>{t}</span>)}</div>
                <div className="facts">
                    <div className="fc"><b data-n>{fmt(vphOf(s))}</b>{L('المتوسط مشاهدة / ساعة', 'Average views / hour')}</div>
                    <div className="fc"><b data-n>{fmt(maxV)}</b>{L('أعلى جلسة (مشاهدة)', 'Top session (views)')}</div>
                    <div className="fc"><b data-n>{fmt(clipCount)}</b>{L('لقطات هذا البث', 'Clips this stream')}</div>
                    <div className="fc"><b data-n>{fmt(cats.length)}</b>{L('فئات البث', 'Stream categories')}</div>
                </div>
            </div>
        </>
    );
};

/* ---------- clips panel ---------- */
const ClCard: React.FC<{ c: Clip; idx: number; rank: number | null; delay: number; onOpen: () => void; L: (a: string, e: string) => string }> = ({ c, idx, rank, delay, onOpen, L }) => {
    const { ref, inView } = useInView<HTMLButtonElement>();
    return (
        <button ref={ref} className={`cl cut rv ${inView ? 'in' : ''}`} style={{ ['--d' as string]: `${delay}s` }} onClick={onOpen} aria-label={c.t}>
            <span className="tb" style={{ ['--h' as string]: c.h }}>
                {c.thumb && <img className="ph" src={c.thumb} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                <span className="pl2"><Ico k="play" /></span>
                <span className="b n">#{idx + 1}</span>
                <span className="b t" dir="ltr">{c.at > 0 ? hm(c.at / 60) : hms(c.dur)}</span>
                <span className="b v" dir="ltr">{fmt(c.v)}</span>
            </span>
            <span className="cb">
                <h4>{c.t}</h4>
                <span className="m">
                    <span>{L('بواسطة', 'by')} <b>{c.by}</b></span>
                    {rank !== null && <b>#{rank + 1}</b>}
                </span>
            </span>
        </button>
    );
};

const ClipsPanel: React.FC<{ s: Sess; clips: Clip[]; onOpen: (c: Clip) => void; L: (a: string, e: string) => string }> = ({ clips, onOpen, L }) => {
    const [cs, setCs] = useState('views');
    const [showAll, setShowAll] = useState(false);
    const order = useMemo(() => new Map(clips.map((c, i) => [c.id, i])), [clips]);
    const ordered = cs === 'views' ? [...clips].sort((a, b) => b.v - a.v) : clips;
    const list = showAll ? ordered : ordered.slice(0, 3);
    return (
        <>
            <div className="phd">
                <h2>{L('لقطات ممتعة من البث', 'Fun clips from the stream')}</h2>
                <small>{showAll ? list.length : Math.min(3, list.length)} {L('من', 'of')} {clips.length} {L('لقطات', 'clips')}</small>
                <span className="sw">
                    {clips.length > 3 && <button className="all-clips" onClick={() => setShowAll(v => !v)}>{showAll ? L('إظهار الأقل', 'Show less') : L('جميع اللقطات', 'All clips')}</button>}
                    <Seg label={L('ترتيب اللقطات', 'Clip order')} value={cs} onChange={setCs} opts={[
                        { id: 'time', label: L('حسب الوقت', 'By time') },
                        { id: 'views', label: L('الأكثر مشاهدة', 'Most viewed') },
                    ]} />
                </span>
            </div>
            <div className="clips">
                {list.length ? list.map((c, i) => (
                    <ClCard key={c.id} c={c} idx={cs === 'views' ? i : (order.get(c.id) ?? i)} rank={cs === 'views' ? i : null} delay={(i % 3) * .08} onOpen={() => onOpen(c)} L={L} />
                )) : <div className="empty">{L('ما في لقطات لهذا البث بعد.', 'No clips from this stream yet.')}</div>}
            </div>
        </>
    );
};

/* ---------- real HLS player ---------- */
interface PlayerItem {
    kind: 'v' | 'c'; src: string; title: string; h: number; tot: number; startAt?: number;
    marks: { f: number; at: number; label: string }[]; kickUrl: string; meta: string;
    reportLabel: string; onReport: () => void;
}
const Player: React.FC<{ item: PlayerItem; onClose: () => void; L: (a: string, e: string) => string }> = ({ item, onClose, L }) => {
    const vidRef = useRef<HTMLVideoElement>(null);
    const vsRef = useRef<HTMLDivElement>(null);
    const startedRef = useRef(false);
    const dragRef = useRef(false);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [t, setT] = useState(0);
    const [tot, setTot] = useState(item.tot);
    const [spd, setSpd] = useState(1);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(false);
    const [retry, setRetry] = useState(0);
    const [fs, setFs] = useState(false);

    /* load HLS */
    useEffect(() => {
        const video = vidRef.current;
        if (!video) return;
        let dead = false;
        let hls: any = null;
        setErr(false); setLoading(true); startedRef.current = false;
        const startPlay = () => {
            video.play().catch(() => { video.muted = true; video.play().catch(() => { }); });
        };
        import('hls.js').then(({ default: Hls }) => {
            if (dead) return;
            if (Hls.isSupported()) {
                hls = new Hls({ maxBufferLength: 30 });
                hls.on(Hls.Events.MANIFEST_PARSED, startPlay);
                hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
                    if (!data.fatal) return;
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                    else { setErr(true); setLoading(false); }
                });
                hls.loadSource(item.src);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = item.src;
                video.addEventListener('loadedmetadata', startPlay, { once: true });
            } else { setErr(true); setLoading(false); }
        }).catch(() => { if (!dead) { setErr(true); setLoading(false); } });
        return () => { dead = true; if (hls) hls.destroy(); };
    }, [item.src, retry]);

    /* media events */
    useEffect(() => {
        const video = vidRef.current;
        if (!video) return;
        const onTime = () => setT(video.currentTime);
        const onDur = () => { if (isFinite(video.duration) && video.duration > 0) setTot(video.duration); };
        const onMeta = () => {
            onDur();
            if (!startedRef.current && item.startAt && item.startAt > 0 && item.startAt < (video.duration || Infinity)) {
                video.currentTime = item.startAt; startedRef.current = true;
            }
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onWait = () => setLoading(true);
        const onPlaying = () => { setLoading(false); setPlaying(true); };
        const onCan = () => setLoading(false);
        const onVol = () => setMuted(video.muted);
        const onEnd = () => setPlaying(false);
        const onErrEl = () => { if (!vidRef.current?.src) return; setErr(true); setLoading(false); };
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('durationchange', onDur);
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWait);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCan);
        video.addEventListener('volumechange', onVol);
        video.addEventListener('ended', onEnd);
        video.addEventListener('error', onErrEl);
        return () => {
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('durationchange', onDur);
            video.removeEventListener('loadedmetadata', onMeta);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWait);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', onCan);
            video.removeEventListener('volumechange', onVol);
            video.removeEventListener('ended', onEnd);
            video.removeEventListener('error', onErrEl);
        };
    }, [item.startAt, retry]);

    const toggle = useCallback(() => {
        const v = vidRef.current; if (!v) return;
        if (v.paused) v.play().catch(() => { }); else v.pause();
    }, []);
    const skip = tot > 3600 ? 300 : 10;
    const seekBy = useCallback((d: number) => {
        const v = vidRef.current; if (!v) return;
        v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || Infinity);
    }, []);
    const toggleMute = useCallback(() => { const v = vidRef.current; if (v) v.muted = !v.muted; }, []);
    const cycleSpd = () => {
        const v = vidRef.current; if (!v) return;
        const next = spd === 1 ? 1.5 : spd === 1.5 ? 2 : 1;
        v.playbackRate = next; setSpd(next);
    };
    const toggleFs = useCallback(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        else vsRef.current?.requestFullscreen().catch(() => { });
    }, []);
    useEffect(() => {
        const onFs = () => setFs(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFs);
        return () => document.removeEventListener('fullscreenchange', onFs);
    }, []);

    /* keyboard (capture so the clip modal underneath stays quiet) */
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const rtl = document.documentElement.dir !== 'ltr';
            const k = e.key;
            if (k === ' ' || k.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); toggle(); }
            else if (k === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); seekBy(rtl ? -skip : skip); }
            else if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); seekBy(rtl ? skip : -skip); }
            else if (k.toLowerCase() === 'm') { e.stopPropagation(); toggleMute(); }
            else if (k.toLowerCase() === 'f') { e.stopPropagation(); toggleFs(); }
            else if (k === 'Escape') { e.stopPropagation(); if (!document.fullscreenElement) onClose(); }
        };
        window.addEventListener('keydown', h, true);
        return () => window.removeEventListener('keydown', h, true);
    }, [toggle, seekBy, toggleMute, toggleFs, onClose, skip]);

    /* scrub */
    const scrubTo = (clientX: number, el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const rtl = document.documentElement.dir !== 'ltr';
        let f = (clientX - r.left) / r.width;
        if (rtl) f = 1 - f;
        f = Math.min(1, Math.max(0, f));
        const v = vidRef.current;
        if (v) { const d = isFinite(v.duration) && v.duration > 0 ? v.duration : tot; v.currentTime = f * d; setT(f * d); }
    };
    const onPbDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        scrubTo(e.clientX, e.currentTarget);
    };
    const onPbMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current) scrubTo(e.clientX, e.currentTarget); };
    const onPbUp = () => { dragRef.current = false; };

    const pct = tot > 0 ? Math.min(100, t / tot * 100) : 0;

    return (
        <div className="pov on" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="pm cut">
                <div ref={vsRef} className={`vs ${playing ? 'playing' : ''} ${loading && !err ? 'loading' : ''}`}
                    style={{ ['--h' as string]: item.h }} onClick={toggle}>
                    <div className="vbg" />
                    <img className="vwm" src={LOGO} alt="" aria-hidden="true" />
                    <video ref={vidRef} playsInline preload="auto" />
                    <div className="vt">
                        <span className="rec"><i />{item.kind === 'v' ? 'VOD' : 'CLIP'}</span>
                        <span className="ttl">{item.title}</span>
                        <small>KICK · HLS</small>
                    </div>
                    <button className="vcen" aria-label={L('تشغيل', 'Play')} onClick={e => { e.stopPropagation(); toggle(); }}><Ico k="play" /></button>
                    <div className="eqv" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                    <span className="ldg" aria-hidden="true" />
                    {err && (
                        <div className="perr" onClick={e => e.stopPropagation()}>
                            <p>{L('تعذّر تشغيل الفيديو من سيرفرات Kick.', 'Playback from Kick servers failed.')}</p>
                            <button className="sbtn" onClick={() => setRetry(r => r + 1)}><Ico k="back" />{L('إعادة المحاولة', 'Retry')}</button>
                            <a className="sbtn" href={item.kickUrl} target="_blank" rel="noreferrer"><Ico k="arr" />{L('افتح على Kick', 'Open on Kick')}</a>
                        </div>
                    )}
                    <div className="ctl" onClick={e => e.stopPropagation()}>
                        <div className="pb" onPointerDown={onPbDown} onPointerMove={onPbMove} onPointerUp={onPbUp} role="slider"
                            aria-label={L('شريط التقدم', 'Seek bar')} aria-valuemin={0} aria-valuemax={Math.round(tot)} aria-valuenow={Math.round(t)}>
                            <span className="tr" />
                            <span className="pf" style={{ width: `${pct}%` }} />
                            {item.marks.map((m, i) => (
                                <button key={i} className="mkr" style={{ insetInlineStart: `${m.f * 100}%` }} title={m.label} aria-label={m.label}
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={e => { e.stopPropagation(); const v = vidRef.current; if (v) v.currentTime = m.at; }} />
                            ))}
                            <span className="kn" style={{ insetInlineStart: `${pct}%` }} />
                        </div>
                        <div className="cr">
                            <button className="cb2" aria-label={L('رجوع', 'Back')} onClick={() => seekBy(-skip)}><Ico k="back" /></button>
                            <button className="cb2 main" aria-label={playing ? L('إيقاف مؤقت', 'Pause') : L('تشغيل', 'Play')} onClick={toggle}><Ico k={playing ? 'pause' : 'play'} /></button>
                            <button className="cb2" aria-label={L('تقديم', 'Forward')} onClick={() => seekBy(skip)}><Ico k="fwd" /></button>
                            <span className="tm">{hms(t)} / {hms(tot)}</span>
                            <span className="sp">
                                <button className="cb2" aria-label={L('السرعة', 'Speed')} onClick={cycleSpd}>×{spd}</button>
                                <button className="cb2" aria-label={muted ? L('تشغيل الصوت', 'Unmute') : L('كتم', 'Mute')} onClick={toggleMute}><Ico k={muted ? 'mute' : 'vol'} /></button>
                                <button className="cb2" aria-label={L('ملء الشاشة', 'Fullscreen')} onClick={toggleFs}><Ico k="fs" /></button>
                                <button className="cb2" aria-label={L('إغلاق', 'Close')} onClick={onClose}><Ico k="x" /></button>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="pinfo">
                    <h3>{item.title}</h3>
                    <span className="meta">{item.meta}</span>
                    <span className="bt">
                        <button className="sbtn" onClick={item.onReport}><Ico k="bolt" />{item.reportLabel}</button>
                        <a className="sbtn" href={item.kickUrl} target="_blank" rel="noreferrer"><Ico k="arr" />{L('فتح على Kick', 'Open on Kick')}</a>
                    </span>
                </div>
                <div className="demo">{fs ? L('اضغط Esc للخروج من ملء الشاشة', 'Press Esc to exit fullscreen') : L('التشغيل مباشرة من سيرفرات Kick · HLS', 'Streaming directly from Kick servers · HLS')}</div>
            </div>
        </div>
    );
};

/* ---------- hero thumbnail ---------- */
const Th: React.FC<{ h: number; thumb?: string; badges?: React.ReactNode; onPlay: () => void; label: string }> = ({ h, thumb, badges, onPlay, label }) => (
    <button className="th cut" style={{ ['--h' as string]: h }} onClick={onPlay} aria-label={label}>
        <span className="bg" />
        <img className="wm" src={LOGO} alt="" aria-hidden="true" />
        {thumb && <img className="ph" src={thumb} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <span className="play"><Ico k="play" /></span>
        {badges}
    </button>
);

/* ============================================================ */
const SessionReport: React.FC<{ lang: Language }> = ({ lang }) => {
    const L = useCallback((ar: string, en: string) => lang === 'ar' ? ar : en, [lang]);
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const update = () => {
            const root = rootRef.current;
            if (!root) return;
            const rect = root.getBoundingClientRect();
            const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / Math.max(1, window.innerHeight + rect.height)));
            root.style.setProperty('--session-shift', `${((0.5 - progress) * 34).toFixed(2)}px`);
        };
        let frame = 0;
        const onScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => { frame = 0; update(); });
        };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);
    const [vods, setVods] = useState<Sess[] | null>(null);
    const [clips, setClips] = useState<Clip[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [cur, setCur] = useState(0);
    const [modalClip, setModalClip] = useState<Clip | null>(null);
    const [player, setPlayer] = useState<PlayerItem | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [jump, setJump] = useState<{ f: number; n: number } | null>(null);
    const toastT = useRef<any>(null);

    const showToast = useCallback((m: string) => {
        setToast(m);
        clearTimeout(toastT.current);
        toastT.current = setTimeout(() => setToast(null), 1800);
    }, []);
    useEffect(() => () => clearTimeout(toastT.current), []);

    /* real data — initial + silent refresh every 10 min */
    const load = useCallback(async () => {
        const [vr, cr] = await Promise.all([
            kickFetch('https://kick.com/api/v2/channels/iabs/videos'),
            kickFetch('https://kick.com/api/v2/channels/iabs/clips'),
        ]);
        if (vr) setVods(mapSess(vr));
        if (cr) setClips(mapClips(cr));
        if (!vr && !cr) setFailed(true); else setFailed(false);
    }, []);
    useEffect(() => {
        load();
        const iv = setInterval(load, 10 * 60 * 1000);
        return () => clearInterval(iv);
    }, [load]);

    const V = vods || [];
    const C = clips || [];
    const sessions = useMemo(() => V.slice(0, 4), [vods]);
    const ci = Math.min(cur, Math.max(sessions.length - 1, 0));
    const s = sessions[ci];

    /* session clips in stream-time order (real moment when available) */
    const sessClips = useMemo(() => {
        if (!s) return [];
        return C.filter(c => c.vodId === s.id)
            .sort((a, b) => (a.at > 0 ? a.at : Infinity) - (b.at > 0 ? b.at : Infinity) || a.ts - b.ts);
    }, [clips, s]);

    /* dates */
    const dateFmt = useCallback((ts: number) => new Date(ts).toLocaleDateString(lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }), [lang]);
    const dateShort = useCallback((ts: number) => new Date(ts).toLocaleDateString(lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US', lang === 'ar' ? { day: 'numeric', month: 'long' } : { month: 'short', day: 'numeric' }), [lang]);
    const agoFmt = useCallback((ts: number) => {
        const days = Math.round((Date.now() - ts) / 86400000);
        const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
        if (days >= 30) return rtf.format(-Math.round(days / 30), 'month');
        if (days >= 1) return rtf.format(-days, 'day');
        return rtf.format(-Math.max(1, Math.round((Date.now() - ts) / 3600000)), 'hour');
    }, [lang]);

    /* delta vs the average of the other sessions */
    const delta = (val: number, get: (x: Sess) => number) => {
        if (!s) return null;
        const others = sessions.filter(x => x.id !== s.id);
        if (!others.length) return null;
        const avg = others.reduce((a, x) => a + get(x), 0) / others.length;
        if (avg <= 0) return null;
        const pct = Math.round((val - avg) / avg * 100);
        if (pct === 0) return { cls: 'eq', txt: L('= المعدل', '= average') };
        return { cls: pct > 0 ? 'up' : 'dn', txt: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${L('عن المعدل', 'vs avg')}` };
    };
    const Dl: React.FC<{ d: { cls: string; txt: string } | null }> = ({ d }) => d ? <span className={`dl ${d.cls}`}>{d.txt}</span> : null;

    /* scroll lock + modal keyboard */
    useEffect(() => {
        if (!modalClip && !player) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [modalClip, player]);
    useEffect(() => {
        if (!modalClip || player) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalClip(null); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [modalClip, player]);

    /* real player */
    const playVod = useCallback((x: Sess, at?: number) => {
        const vc = C.filter(c => c.vodId === x.id && c.at > 0);
        setPlayer({
            kind: 'v', src: x.src, title: x.t, h: x.h, tot: x.sec, startAt: at,
            marks: vc.map(c => ({ f: Math.min(c.at / Math.max(x.sec, 1), 1), at: c.at, label: c.t })),
            kickUrl: `https://kick.com/iabs/videos/${x.uuid}`,
            meta: `${dateFmt(x.ts)} · ${durTxt(x.min)} · ${fmt(x.v)} ${L('مشاهدة', 'views')}`,
            reportLabel: L('تقرير الجلسة', 'Session report'),
            onReport: () => { setPlayer(null); rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        });
    }, [clips, dateFmt, L]);
    const playClip = useCallback((c: Clip) => {
        setPlayer({
            kind: 'c', src: c.src, title: c.t, h: c.h, tot: c.dur,
            marks: [], kickUrl: `https://kick.com/iabs?clip=${c.id}`,
            meta: `${L('الصانع:', 'By:')} ${c.by} · ${fmt(c.v)} ${L('مشاهدة', 'views')}`,
            reportLabel: L('تقرير اللقطة', 'Clip report'),
            onReport: () => { setPlayer(null); setModalClip(c); },
        });
    }, [L]);

    /* copy actions */
    const copyText = useCallback((txt: string, ok: string) => {
        navigator.clipboard?.writeText(txt)
            .then(() => showToast(ok))
            .catch(() => showToast(L('تعذّر النسخ', 'Copy failed')));
    }, [L, showToast]);
    const copySummary = () => {
        if (!s) return;
        copyText(
            `${s.t} · ${dateFmt(s.ts)}\n${L('المدة:', 'Duration:')} ${durTxt(s.min)} · ${L('المشاهدات:', 'Views:')} ${fmt(s.v)} · ${fmt(vphOf(s))} ${L('مشاهدة/ساعة', 'views/hr')} · ${L('الذروة:', 'Peak:')} ${fmt(s.pk)}`,
            L('تم نسخ ملخص الجلسة', 'Session summary copied'),
        );
    };
    const copyLink = () => { if (s) copyText(`https://kick.com/iabs/videos/${s.uuid}`, L('تم نسخ الرابط', 'Link copied')); };

    /* ---------- portal ---------- */
    const portal = typeof document !== 'undefined' ? createPortal(
        <div className="absr absr-ovl">
            {modalClip && (
                <div className="ov on" onClick={e => { if (e.target === e.currentTarget) setModalClip(null); }}>
                    <div className="md cut" role="dialog" aria-modal="true" aria-label={modalClip.t}>
                        <button className="x" aria-label={L('إغلاق', 'Close')} onClick={() => setModalClip(null)}><Ico k="x" /></button>
                        <Th h={modalClip.h} thumb={modalClip.thumb} onPlay={() => playClip(modalClip)} label={`${L('تشغيل', 'Play')} ${modalClip.t}`}
                            badges={<>
                                <span className="b a">CLIP</span>
                                <span className="b c">{modalClip.by}</span>
                                <span className="b d" dir="ltr">{fmt(modalClip.v)}</span>
                            </>} />
                        <h3>{modalClip.t}</h3>
                        <div className="mm">
                            {modalClip.at > 0 && <span>{L('اللحظة في التسجيل:', 'Moment in VOD:')} <b dir="ltr">{hm(modalClip.at / 60)}</b></span>}
                            {s && <span>{L('من بث:', 'From stream:')} <b>{s.t}</b></span>}
                            <span>{L('المدة:', 'Duration:')} <b dir="ltr">{hms(modalClip.dur)}</b></span>
                        </div>
                        <div className="acts">
                            <Cta title={L('تشغيل اللقطة', 'Play the clip')} sub={`${modalClip.by} · ${hms(modalClip.dur)}`} onClick={() => playClip(modalClip)} />
                            {modalClip.at > 0 && s && s.sec > 0 && (
                                <button className="gb" aria-label={L('الانتقال للحظة في المنحنى', 'Jump to the moment on the curve')} title={L('الانتقال للحظة في المنحنى', 'Jump to the moment on the curve')}
                                    onClick={() => { setModalClip(null); setJump({ f: Math.min(modalClip.at / s.sec, 1), n: Date.now() }); }}>
                                    <Ico k="clk" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {player && <Player item={player} onClose={() => setPlayer(null)} L={L} />}
            <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
        </div>,
        document.body
    ) : null;

    /* ---------- loading / failure ---------- */
    if ((vods === null || clips === null) && !failed) {
        return (
            <div className="absr" aria-busy="true">
                <div className="sk" style={{ height: 52 }} />
                <div className="rail">{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 86 }} />)}</div>
                <div className="sk" style={{ height: 360 }} />
                <div className="kpi">{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 110 }} />)}</div>
                {portal}
            </div>
        );
    }
    if (!s) {
        return (
            <div className="absr">
                <div className="empty">
                    {L('تعذّر تحميل تقرير الجلسات من Kick.', 'Could not load the session report from Kick.')}
                    <div style={{ marginTop: 14 }}><button className="sbtn" onClick={load}><Ico k="back" />{L('إعادة المحاولة', 'Retry')}</button></div>
                </div>
                {portal}
            </div>
        );
    }

    const maxVph = Math.max(...sessions.map(vphOf), 1);
    const maxPk = Math.max(...sessions.map(x => x.pk), 1);
    const maxV = Math.max(...sessions.map(x => x.v), 1);
    const maxMin = Math.max(...sessions.map(x => x.min), 1);
    const Vph = vphOf(s);

    const Hero = () => {
        const { ref, inView } = useInView<HTMLElement>();
        return (
            <section ref={ref} className={`hero cut rv ${inView ? 'in' : ''}`}>
                <div className="hr1">
                    <div className="mt">
                        <span className={`pub ${s.sub ? 'sub' : ''}`}><i />{s.sub ? 'SUB ONLY' : 'PUBLIC'}</span>
                        <span className="dt">{dateFmt(s.ts)} · {agoFmt(s.ts)}</span>
                    </div>
                    <h1 className={s.t.length > 70 ? 'xlong' : s.t.length > 42 ? 'long' : ''}>{s.t}</h1>
                    <div className="tg">{s.tags.map(t => <span key={t}>{t}</span>)}</div>
                    <div className="acts">
                        <Cta title={L('مشاهدة التسجيل', 'Watch the VOD')} sub={`${durTxt(s.min)} · ${fmt(s.v)} ${L('مشاهدة', 'views')}`} onClick={() => playVod(s)} />
                        <button className="gb" aria-label={L('نسخ ملخص الجلسة', 'Copy session summary')} title={L('نسخ ملخص الجلسة', 'Copy session summary')} onClick={copySummary}><Ico k="cpy" /></button>
                        <button className="gb" aria-label={L('نسخ رابط الجلسة', 'Copy session link')} title={L('نسخ رابط الجلسة', 'Copy session link')} onClick={copyLink}><Ico k="shr" /></button>
                    </div>
                </div>
                <Th h={s.h} thumb={s.thumb} onPlay={() => playVod(s)} label={`${L('تشغيل', 'Play')} ${s.t}`}
                    badges={<>
                        <span className="b a">VOD</span>
                        <span className="b c" dir="ltr">{durTxt(s.min)}</span>
                        <span className="b d" dir="ltr">{fmt(s.v)} {L('مشاهدة', 'views')}</span>
                    </>} />
            </section>
        );
    };

    return (
        <div className="absr" ref={rootRef}>
            <Rv className="session-head">
                <span className="session-head-num" dir="ltr">04</span>
                <div className="session-head-copy">
                    <span className="session-head-tag" dir="ltr">SESSION REPORT</span>
                    <h2>{L('تقرير الجلسة الأخيرة', 'Last session report')}</h2>
                    <p>{L('ملخص كامل لأحدث بثوث Kick واللقطات والإحصائيات.', 'A complete summary of the latest Kick sessions, clips and stats.')}</p>
                </div>
                <span className="session-head-line" />
            </Rv>
            <Rv className="rail">
                {sessions.map((x, i) => (
                    <button key={x.id} className={`sr cut ${i === ci ? 'on' : ''}`} onClick={() => setCur(i)} aria-pressed={i === ci}>
                        <small>{dateShort(x.ts)}{i === 0 && <em>{L('الأحدث', 'LATEST')}</em>}</small>
                        <b>{x.t}</b>
                        <span><i data-n>{fmt(x.v)}</i> {L('مشاهدة', 'views')} · <span dir="ltr">{durTxt(x.min)}</span></span>
                    </button>
                ))}
            </Rv>
            <Hero />
            <Rv className="kpi">
                <div className="k cut">
                    <Ring ratio={Vph / maxVph} icon="bolt" />
                    <div><b><Num value={Vph} /></b><span>{L('مشاهدة / ساعة', 'views / hour')}</span><Dl d={delta(Vph, vphOf)} /></div>
                </div>
                <div className="k cut">
                    <Ring ratio={s.pk / maxPk} icon="fire" />
                    <div><b><Num value={s.pk} /></b><span>{L('الذروة (مشاهد متزامن)', 'Peak concurrent viewers')}</span><Dl d={delta(s.pk, x => x.pk)} /></div>
                </div>
                <div className="k cut">
                    <Ring ratio={s.v / maxV} icon="eye" />
                    <div><b><Num value={s.v} /></b><span>{L('المشاهدات', 'Total views')}</span><Dl d={delta(s.v, x => x.v)} /></div>
                </div>
                <div className="k cut">
                    <Ring ratio={s.min / maxMin} icon="clk" />
                    <div><b dir="ltr">{durTxt(s.min)}</b><span>{L('المدة', 'Duration')}</span><Dl d={delta(s.min, x => x.min)} /></div>
                </div>
            </Rv>
            <Rv className="pn cut">
                <ChartPanel s={s} clips={sessClips} jump={jump} onClip={setModalClip} L={L} />
            </Rv>
            <div className="two">
                <Rv className="pn cut">
                    <LadderPanel sessions={sessions} cur={ci} onPick={setCur} dateShort={dateShort} L={L} />
                </Rv>
                <Rv className="pn cut" delay={.1}>
                    <CatPanel s={s} sessions={sessions} clipCount={sessClips.length} L={L} />
                </Rv>
            </div>
            <Rv className="pn cut">
                <ClipsPanel s={s} clips={sessClips} onOpen={setModalClip} L={L} />
            </Rv>
            {portal}
        </div>
    );
};

export default SessionReport;
