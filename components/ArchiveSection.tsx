import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './ArchiveSection.css';
import { Language } from '../types';
import { kickFetch } from '../utils/kickApi';

/* ============================================================
   ABS Archive — «آخر اللقطات والفيديوهات»
   Design: exact port of abs-archive (3).html (v4 rounded).
   Data: 100% real — Kick VODs + clips via the /api/kick proxy,
   playback is real HLS straight from Kick's public servers.
   ============================================================ */

const LOGO = 'https://files.kick.com/images/user/1106194/profile_image/conversion/140c7236-24f9-4267-b318-6be659f6035e-fullsize.webp';
const FAV_KEY = 'iabs_archive_favs_v1';

interface Vod {
    id: number; t: string; ts: number; min: number; sec: number; v: number; pk: number;
    cat: string; tags: string[]; uuid: string; src: string; thumb: string; h: number;
}
interface Clip {
    id: string; t: string; by: string; v: number; ts: number; dur: number; at: number;
    vodId: number; src: string; thumb: string; h: number;
}

function mapVods(res: any): Vod[] {
    const d = res?.data ?? res;
    const arr: any[] = Array.isArray(d) ? d : (d?.videos || d?.data || []);
    return arr
        .filter(x => x && x.source && x.video?.status !== 'private' && !x.video?.is_pruned)
        .map(x => {
            const cat = x.categories?.[0]?.name || 'IRL';
            const tags = Array.from(new Set([x.language, ...(x.categories?.[0]?.tags || [])].filter(Boolean))) as string[];
            const ts = Date.parse((x.created_at || '').replace(' ', 'T') + 'Z') || 0;
            return {
                id: x.id, t: x.session_title || 'بث بدون عنوان', ts,
                min: Math.round((x.duration || 0) / 60000), sec: Math.round((x.duration || 0) / 1000),
                v: x.views || x.video?.views || 0, pk: x.viewer_count || 0,
                cat, tags, uuid: x.video?.uuid || x.slug || String(x.id),
                src: x.source, thumb: x.thumbnail?.src || '', h: (x.id * 47) % 360,
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
    heart: <path d="M12 20.5s-7.4-4.6-9.7-9C.9 8 2.8 4.7 6.3 4.7c2.1 0 3.8 1.2 5.7 3.3 1.9-2.1 3.6-3.3 5.7-3.3 3.5 0 5.4 3.3 4 6.8-2.3 4.4-9.7 9-9.7 9z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />,
    x: <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />,
    prev: <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
    next: <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
    back: <path d="M11 19l-7-7 7-7M20 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
    fwd: <path d="M13 5l7 7-7 7M4 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
    vol: <><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    mute: <><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    fs: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
    search: <><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth={2.4} /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /></>,
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
interface SegOpt { id: string; label: string; badge?: number }
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
                <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
                    {o.label}{o.badge !== undefined && <em data-n>{o.badge}</em>}
                </button>
            ))}
        </div>
    );
};

/* ---------- thumbnail ---------- */
const Tb: React.FC<{ h: number; thumb?: string; cls?: string; badges?: React.ReactNode; onPlay?: () => void; label?: string }> = ({ h, thumb, cls = '', badges, onPlay, label }) => (
    <div className={`tb cut ${cls}`} style={{ ['--h' as string]: h }} onClick={onPlay} role={onPlay ? 'button' : undefined} aria-label={label} tabIndex={onPlay ? 0 : undefined}
        onKeyDown={onPlay ? e => { if (e.key === 'Enter') { e.stopPropagation(); onPlay(); } } : undefined}>
        <div className="bg" />
        <img className="wm" src={LOGO} alt="" aria-hidden="true" />
        {thumb && <img className="ph" src={thumb} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <span className="play"><Ico k="play" /></span>
        {badges}
        <div className="sc"><i /></div>
    </div>
);

/* ---------- card shell ---------- */
const Card: React.FC<{ delay: number; big?: boolean; onOpen: () => void; children: React.ReactNode; label: string }> = ({ delay, big, onOpen, children, label }) => {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className={`card cut rv ${inView ? 'in' : ''} ${big ? 'big' : ''}`} style={{ ['--d' as string]: `${delay}s` }}
            role="button" tabIndex={0} aria-label={label} onClick={onOpen}
            onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}>
            {children}
        </div>
    );
};

const Heart: React.FC<{ on: boolean; onToggle: () => void; label: string }> = ({ on, onToggle, label }) => (
    <button className={`hb ${on ? 'on' : ''}`} aria-pressed={on} aria-label={label}
        onClick={e => { e.stopPropagation(); onToggle(); }}><Ico k="heart" /></button>
);

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

/* ---------- estimated viewers curve (seeded, labeled as estimate) ---------- */
function series(v: Vod): number[] {
    const N = 48;
    let seed = (v.id * 17 + v.v) % 233280;
    const raw: number[] = [];
    for (let i = 0; i < N; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        const x = seed / 233280;
        raw.push(Math.max(.08, (.55 + .45 * Math.sin(i / N * Math.PI * 1.6 + .4)) * (.4 + x)));
    }
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map(r => r / sum * Math.max(v.v, 1));
}

const Curve: React.FC<{ v: Vod; vclips: Clip[]; onClip: (c: Clip) => void; L: (a: string, e: string) => string }> = ({ v, vclips, onClip, L }) => {
    const vals = useMemo(() => series(v), [v]);
    const [hov, setHov] = useState<{ f: number; i: number } | null>(null);
    const N = vals.length;
    const mx = Math.max(...vals) * 1.1;
    const Y = (x: number) => 92 - x / mx * 82;
    const pts = vals.map((x, i) => `${(i / (N - 1) * 100).toFixed(2)},${Y(x).toFixed(2)}`).join(' ');
    const minutes = Math.max(v.min, 1);
    let pkI = 1, pkD = -Infinity;
    for (let i = 1; i < N; i++) { const d = vals[i] - vals[i - 1]; if (d > pkD) { pkD = d; pkI = i; } }
    const marks = vclips.map((c, k) => {
        const f = c.at > 0 && v.sec > 0 ? Math.min(c.at / v.sec, 1) : (k + 1) / (vclips.length + 1);
        return { c, f, i: Math.round(f * (N - 1)) };
    });
    const move = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        setHov({ f, i: Math.min(N - 1, Math.round(f * (N - 1))) });
    };
    return (
        <>
            <div className={`cv ${hov ? 'on' : ''}`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHov(null)}>
                {[25, 50, 75].map(p => <span key={p} className="gl" style={{ top: `${p}%` }} />)}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id={`absa-g${v.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#ff2f3a" stopOpacity=".55" />
                            <stop offset="1" stopColor="#ff2f3a" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${pts} 100,100`} fill={`url(#absa-g${v.id})`} />
                    <polyline points={pts} fill="none" stroke="#ff6a72" strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
                <span className="pk" style={{ left: `${pkI / (N - 1) * 100}%`, top: `${Y(vals[pkI])}%` }} />
                {marks.map((m, k) => (
                    <button key={m.c.id} className="mk" style={{ left: `${m.f * 100}%`, top: `${Y(vals[m.i])}%` }}
                        title={m.c.t} aria-label={`${L('لقطة', 'Clip')} ${k + 1}: ${m.c.t}`}
                        onClick={e => { e.stopPropagation(); onClip(m.c); }}>{k + 1}</button>
                ))}
                <span className="cur" style={{ left: `${(hov?.f || 0) * 100}%` }} />
                <span className="tip" style={{ left: `${(hov?.f || 0) * 100}%` }} dir="ltr">
                    {hov ? `${hm(hov.f * minutes)} · ${fmt(vals[hov.i])}` : ''}
                </span>
            </div>
            <div className="ax2"><span>0:00</span><span>{hm(minutes / 2)}</span><span>{hm(minutes)}</span></div>
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

    /* keyboard (capture so the report modal underneath stays quiet) */
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
                    <span className="ld" aria-hidden="true" />
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

/* ============================================================ */
const ArchiveSection: React.FC<{ lang: Language }> = ({ lang }) => {
    const L = useCallback((ar: string, en: string) => lang === 'ar' ? ar : en, [lang]);
    const [vods, setVods] = useState<Vod[] | null>(null);
    const [clips, setClips] = useState<Clip[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [q, setQ] = useState('');
    const [ty, setTy] = useState('all');
    const [cat, setCat] = useState('all');
    const [srt, setSrt] = useState('new');
    const [showAllVods, setShowAllVods] = useState(false);
    const [showAllClips, setShowAllClips] = useState(false);
    const [favs, setFavs] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); }
    });
    const [modal, setModal] = useState<{ k: 'v' | 'c'; id: string } | null>(null);
    const [player, setPlayer] = useState<PlayerItem | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastT = useRef<any>(null);
    const deepLinked = useRef(false);

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
        if (vr) setVods(mapVods(vr));
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
    const vodById = useMemo(() => new Map(V.map(v => [v.id, v])), [vods]);
    const clipsOf = useCallback((id: number) => C.filter(c => c.vodId === id), [clips]);

    /* deep links #vod-ID / #clip-ID */
    useEffect(() => {
        if (deepLinked.current || !vods || !clips) return;
        deepLinked.current = true;
        const m = location.hash.match(/^#(vod|clip)-(.+)$/);
        if (!m) return;
        if (m[1] === 'vod' && vods.some(v => String(v.id) === m[2])) setModal({ k: 'v', id: m[2] });
        if (m[1] === 'clip' && clips.some(c => c.id === m[2])) setModal({ k: 'c', id: m[2] });
    }, [vods, clips]);

    /* favorites */
    const toggleFav = useCallback((key: string) => {
        setFavs(prev => {
            const next = new Set(prev);
            const adding = !next.has(key);
            if (adding) next.add(key); else next.delete(key);
            try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])); } catch { }
            showToast(adding ? L('انضافت للمفضلة ❤', 'Added to favorites ❤') : L('انشالت من المفضلة', 'Removed from favorites'));
            return next;
        });
    }, [L, showToast]);

    /* filtering + sorting */
    const cats = useMemo(() => Array.from(new Set(V.map(v => v.cat))), [vods]);
    const ql = q.trim().toLowerCase();
    const shownVods = useMemo(() => {
        if (ty === 'clip') return [];
        let list = ty === 'fav' ? V.filter(v => favs.has(`v${v.id}`)) : V;
        if (cat !== 'all') list = list.filter(v => v.cat === cat);
        if (ql) list = list.filter(v => (v.t + ' ' + v.tags.join(' ') + ' ' + v.cat).toLowerCase().includes(ql));
        return [...list].sort((a, b) => srt === 'views' ? b.v - a.v : srt === 'long' ? b.min - a.min : b.ts - a.ts);
    }, [vods, ty, cat, ql, srt, favs]);
    const shownClips = useMemo(() => {
        if (ty === 'vod') return [];
        let list = ty === 'fav' ? C.filter(c => favs.has(`c${c.id}`)) : C;
        if (cat !== 'all') list = list.filter(c => vodById.get(c.vodId)?.cat === cat);
        if (ql) list = list.filter(c => (c.t + ' ' + c.by + ' ' + (vodById.get(c.vodId)?.t || '')).toLowerCase().includes(ql));
        return [...list].sort((a, b) => srt === 'new' ? b.ts - a.ts : srt === 'long' ? b.dur - a.dur : b.v - a.v);
    }, [clips, ty, cat, ql, srt, favs, vodById]);

    const displayVods = showAllVods ? shownVods : shownVods.slice(0, 6);
    const displayClips = showAllClips ? shownClips : shownClips.slice(0, 9);

    useEffect(() => {
        setShowAllVods(false);
        setShowAllClips(false);
    }, [ty, cat, ql, srt]);

    /* date helpers */
    const dateFmt = useCallback((ts: number) => new Date(ts).toLocaleDateString(lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }), [lang]);
    const agoFmt = useCallback((ts: number) => {
        const days = Math.round((Date.now() - ts) / 86400000);
        const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
        if (days >= 30) return rtf.format(-Math.round(days / 30), 'month');
        if (days >= 1) return rtf.format(-days, 'day');
        return rtf.format(-Math.max(1, Math.round((Date.now() - ts) / 3600000)), 'hour');
    }, [lang]);

    /* stats */
    const totViews = V.reduce((a, v) => a + v.v, 0);
    const totHours = Math.round(V.reduce((a, v) => a + v.min, 0) / 60);
    const totClipViews = C.reduce((a, c) => a + c.v, 0);
    const vph = (v: Vod) => Math.round(v.v / Math.max(v.min / 60, 1 / 60));

    /* modal navigation */
    const navList: (Vod | Clip)[] = modal?.k === 'v' ? (shownVods.length ? shownVods : V) : (shownClips.length ? shownClips : C);
    const go = useCallback((d: number) => {
        setModal(m => {
            if (!m) return m;
            const list = m.k === 'v' ? (shownVods.length ? shownVods : V) : (shownClips.length ? shownClips : C);
            const i = list.findIndex(x => String(x.id) === m.id);
            const n = i + d;
            if (i < 0 || n < 0 || n >= list.length) {
                showToast(d > 0 ? L('هذا آخر عنصر', 'This is the last item') : L('هذا أول عنصر', 'This is the first item'));
                return m;
            }
            return { k: m.k, id: String(list[n].id) };
        });
    }, [shownVods, shownClips, V, C, L, showToast]);

    /* scroll lock + modal keyboard */
    useEffect(() => {
        if (!modal && !player) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [modal, player]);
    useEffect(() => {
        if (!modal || player) return;
        const h = (e: KeyboardEvent) => {
            const rtl = document.documentElement.dir !== 'ltr';
            if (e.key === 'Escape') setModal(null);
            else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
            else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [modal, player, go]);

    /* open real player */
    const playVod = useCallback((v: Vod, at?: number) => {
        const vc = clipsOf(v.id).filter(c => c.at > 0);
        setPlayer({
            kind: 'v', src: v.src, title: v.t, h: v.h, tot: v.sec, startAt: at,
            marks: vc.map(c => ({ f: Math.min(c.at / Math.max(v.sec, 1), 1), at: c.at, label: c.t })),
            kickUrl: `https://kick.com/iabs/videos/${v.uuid}`,
            meta: `${dateFmt(v.ts)} · ${durTxt(v.min)} · ${fmt(v.v)} ${L('مشاهدة', 'views')}`,
            reportLabel: L('تقرير الجلسة', 'Session report'),
            onReport: () => { setPlayer(null); setModal({ k: 'v', id: String(v.id) }); },
        });
    }, [clipsOf, dateFmt, L]);
    const playClip = useCallback((c: Clip) => {
        const parent = vodById.get(c.vodId);
        setPlayer({
            kind: 'c', src: c.src, title: c.t, h: c.h, tot: c.dur,
            marks: [], kickUrl: `https://kick.com/iabs?clip=${c.id}`,
            meta: `${L('الصانع:', 'By:')} ${c.by} · ${fmt(c.v)} ${L('مشاهدة', 'views')}`,
            reportLabel: L('تقرير اللقطة', 'Clip report'),
            onReport: () => { setPlayer(null); setModal({ k: 'c', id: c.id }); },
        });
        void parent;
    }, [vodById, L]);

    const copyUrl = useCallback((url: string) => {
        navigator.clipboard?.writeText(url)
            .then(() => showToast(L('تم نسخ الرابط', 'Link copied')))
            .catch(() => showToast(L('انسخ الرابط من Kick مباشرة', 'Copy the link from Kick directly')));
    }, [L, showToast]);

    /* ---------- render helpers ---------- */
    const featured = V[0];
    const loadingData = vods === null || clips === null;

    const vodCard = (v: Vod, i: number) => (
        <Card key={v.id} delay={(i % 6) * .06} onOpen={() => setModal({ k: 'v', id: String(v.id) })} label={v.t}>
            <Tb h={v.h} thumb={v.thumb} onPlay={() => playVod(v)} label={`${L('تشغيل', 'Play')} ${v.t}`}
                badges={<>
                    <span className="b e">{v.cat}</span>
                    <span className="b c" dir="ltr">{durTxt(v.min)}</span>
                    <span className="b d" dir="ltr">{fmt(v.v)}</span>
                </>} />
            <Heart on={favs.has(`v${v.id}`)} onToggle={() => toggleFav(`v${v.id}`)} label={L('مفضلة', 'Favorite')} />
            <div className="cb">
                <h4>{v.t}</h4>
                <div className="meta">
                    <span>{dateFmt(v.ts)}</span>
                    <span><b data-n>{fmt(vph(v))}</b> {L('مشاهدة/ساعة', 'views/hr')}</span>
                </div>
                <div className="tags">{v.tags.slice(0, 3).map(t => <span key={t}>{t}</span>)}</div>
            </div>
        </Card>
    );

    const clipCard = (c: Clip, i: number, big = false) => {
        const parent = vodById.get(c.vodId);
        return (
            <Card key={c.id} delay={(i % 6) * .06} big={big} onOpen={() => setModal({ k: 'c', id: c.id })} label={c.t}>
                <Tb h={c.h} thumb={c.thumb} onPlay={() => playClip(c)} label={`${L('تشغيل', 'Play')} ${c.t}`}
                    badges={<>
                        <span className="b a">{srt === 'views' ? `#${i + 1}` : 'CLIP'}</span>
                        <span className="b c" dir="ltr">{c.at > 0 ? hm(c.at / 60) : hms(c.dur)}</span>
                        <span className="b d" dir="ltr">{fmt(c.v)}</span>
                    </>} />
                <Heart on={favs.has(`c${c.id}`)} onToggle={() => toggleFav(`c${c.id}`)} label={L('مفضلة', 'Favorite')} />
                <div className="cb">
                    <h4>{c.t}</h4>
                    <div className="meta">
                        <span><b>{c.by}</b></span>
                        {parent && <span>{L('من:', 'from:')} {parent.t.length > 34 ? parent.t.slice(0, 34) + '…' : parent.t}</span>}
                    </div>
                </div>
            </Card>
        );
    };

    /* delta vs the average of the other VODs */
    const delta = (val: number, get: (v: Vod) => number, self: Vod) => {
        const others = V.filter(v => v.id !== self.id);
        if (!others.length) return null;
        const avg = others.reduce((a, v) => a + get(v), 0) / others.length;
        if (avg <= 0) return null;
        const pct = Math.round((val - avg) / avg * 100);
        return { up: pct >= 0, txt: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%` };
    };
    const Dl: React.FC<{ d: { up: boolean; txt: string } | null }> = ({ d }) => d ? <span className={`dl ${d.up ? 'up' : 'dn'}`}>{d.txt}</span> : null;

    const modalVod = modal?.k === 'v' ? vodById.get(Number(modal.id)) : undefined;
    const modalClip = modal?.k === 'c' ? C.find(c => c.id === modal.id) : undefined;

    const navBar = (label: string) => (
        <div className="mt">
            <span className="pub"><i />{label}</span>
            <span className="nav">
                <button className="ib" aria-label={L('السابق', 'Previous')} onClick={() => go(-1)}><Ico k="prev" /></button>
                <button className="ib" aria-label={L('التالي', 'Next')} onClick={() => go(1)}><Ico k="next" /></button>
                <button className="ib cl" aria-label={L('إغلاق', 'Close')} onClick={() => setModal(null)}><Ico k="x" /></button>
            </span>
        </div>
    );

    const dockBar = (key: string, pc: string, title: string, sub: string, onPlay: () => void, url: string) => (
        <div className="dock">
            <Cta pc={pc} title={title} sub={sub} onClick={onPlay} />
            <button className="gb" aria-pressed={favs.has(key)} aria-label={L('مفضلة', 'Favorite')} onClick={() => toggleFav(key)}
                style={favs.has(key) ? { background: 'var(--red)', color: '#fff' } : undefined}><Ico k="heart" /></button>
            <button className="gb" aria-label={L('نسخ الرابط', 'Copy link')} onClick={() => copyUrl(url)}><Ico k="cpy" /></button>
        </div>
    );

    /* ---------- section head ---------- */
    const Head = () => {
        const { ref, inView } = useInView<HTMLDivElement>();
        return (
            <div ref={ref} className={`sh rv ${inView ? 'in' : ''}`}>
                <span className="num" aria-hidden="true">03</span>
                <div className="tx">
                    <span className="tag">ARCHIVE</span>
                    <h2>{L('آخر اللقطات والفيديوهات', 'Latest Clips & Videos')}</h2>
                    <p>{L('كل بثوث iABS ولقطاته. افتح أي بث لتشوف تقرير الجلسة كاملاً.', 'Every iABS stream and clip. Open any VOD for the full session report.')}</p>
                </div>
                <span className="ln" />
            </div>
        );
    };

    const Featured = ({ v }: { v: Vod }) => {
        const { ref, inView } = useInView<HTMLElement>();
        return (
            <section ref={ref} className={`fe cut rv ${inView ? 'in' : ''}`}>
                <Tb h={v.h} thumb={v.thumb} cls="big" onPlay={() => playVod(v)} label={`${L('تشغيل', 'Play')} ${v.t}`}
                    badges={<>
                        <span className="b a">{L('الأحدث', 'LATEST')}</span>
                        <span className="b c" dir="ltr">{durTxt(v.min)}</span>
                        <span className="b d" dir="ltr">{fmt(v.v)}</span>
                    </>} />
                <div className="fi">
                    <span className="pub"><i />PUBLIC</span>
                    <h3>{v.t}</h3>
                    <div className="meta">
                        <span>{dateFmt(v.ts)} · {agoFmt(v.ts)}</span>
                        <span>{L('الفئة:', 'Category:')} <b>{v.cat}</b></span>
                        <span><b data-n>{fmt(vph(v))}</b> {L('مشاهدة/ساعة', 'views/hr')}</span>
                    </div>
                    <div className="pills">{v.tags.map(t => <span key={t}>{t}</span>)}</div>
                    <div className="acts">
                        <Cta title={L('مشاهدة التسجيل', 'Watch the VOD')} sub={`${durTxt(v.min)} · ${fmt(v.v)} ${L('مشاهدة', 'views')}`} onClick={() => playVod(v)} />
                        <button className="sbtn" onClick={() => setModal({ k: 'v', id: String(v.id) })}><Ico k="bolt" />{L('تقرير الجلسة', 'Session report')}</button>
                    </div>
                </div>
            </section>
        );
    };

    /* ---------- portal (modals / player / toast above the navbar) ---------- */
    const portal = typeof document !== 'undefined' ? createPortal(
        <div className="absa absa-ovl">
            {modalVod && (
                <div className="ov on" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
                    <div className="md cut" role="dialog" aria-modal="true" aria-label={modalVod.t}>
                        {navBar('PUBLIC · VOD')}
                        <h3>{modalVod.t}</h3>
                        <div className="mm">
                            <span>{dateFmt(modalVod.ts)} · {agoFmt(modalVod.ts)}</span>
                            <span>{L('الفئة:', 'Category:')} <b>{modalVod.cat}</b></span>
                        </div>
                        <div className="pills">{modalVod.tags.map(t => <span key={t}>{t}</span>)}</div>
                        <Tb h={modalVod.h} thumb={modalVod.thumb} cls="big" onPlay={() => playVod(modalVod)} label={`${L('تشغيل', 'Play')} ${modalVod.t}`}
                            badges={<>
                                <span className="b a">VOD</span>
                                <span className="b c" dir="ltr">{durTxt(modalVod.min)}</span>
                                <span className="b d" dir="ltr">{fmt(modalVod.v)}</span>
                            </>} />
                        <div className="kp">
                            <div className="kt">
                                <div className="tp"><span className="ic2"><Ico k="bolt" /></span><Dl d={delta(vph(modalVod), vph, modalVod)} /></div>
                                <b data-n>{fmt(vph(modalVod))}</b><span>{L('مشاهدة / ساعة', 'views / hour')}</span>
                            </div>
                            <div className="kt">
                                <div className="tp"><span className="ic2"><Ico k="fire" /></span><Dl d={delta(modalVod.pk, v => v.pk, modalVod)} /></div>
                                <b data-n>{fmt(modalVod.pk)}</b><span>{L('الذروة (مشاهد متزامن)', 'Peak concurrent viewers')}</span>
                            </div>
                            <div className="kt">
                                <div className="tp"><span className="ic2"><Ico k="eye" /></span><Dl d={delta(modalVod.v, v => v.v, modalVod)} /></div>
                                <b data-n>{fmt(modalVod.v)}</b><span>{L('المشاهدات', 'Total views')}</span>
                            </div>
                            <div className="kt">
                                <div className="tp"><span className="ic2"><Ico k="clk" /></span><Dl d={delta(modalVod.min, v => v.min, modalVod)} /></div>
                                <b data-n>{durTxt(modalVod.min)}</b><span>{L('المدة', 'Duration')}</span>
                            </div>
                        </div>
                        <div className="box">
                            <h5>{L('منحنى المشاهدات', 'Viewers curve')}<small>{L('تقديري · مرّر على المنحنى', 'Estimated · hover the curve')}</small></h5>
                            <Curve v={modalVod} vclips={clipsOf(modalVod.id)} onClip={c => setModal({ k: 'c', id: c.id })} L={L} />
                        </div>
                        <div className="box">
                            <h5>{L('لقطات من هذا البث', 'Clips from this stream')}<small>{clipsOf(modalVod.id).length}</small></h5>
                            {clipsOf(modalVod.id).length ? (
                                <div className="cs">
                                    {clipsOf(modalVod.id).map(c => (
                                        <div key={c.id} className="card cut" role="button" tabIndex={0} aria-label={c.t}
                                            onClick={() => setModal({ k: 'c', id: c.id })}
                                            onKeyDown={e => { if (e.key === 'Enter') setModal({ k: 'c', id: c.id }); }}>
                                            <Tb h={c.h} thumb={c.thumb} cls="sm" onPlay={() => playClip(c)} label={`${L('تشغيل', 'Play')} ${c.t}`}
                                                badges={<>
                                                    <span className="b c" dir="ltr">{hms(c.dur)}</span>
                                                    <span className="b d" dir="ltr">{fmt(c.v)}</span>
                                                </>} />
                                            <div className="cb">
                                                <h4>{c.t}</h4>
                                                <div className="meta"><span><b>{c.by}</b></span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="empty">{L('ما في لقطات لهذا البث بعد.', 'No clips from this stream yet.')}</div>}
                        </div>
                        {dockBar(`v${modalVod.id}`, '#ff2f3a', L('مشاهدة التسجيل', 'Watch the VOD'), `${durTxt(modalVod.min)} · ${fmt(modalVod.v)} ${L('مشاهدة', 'views')}`, () => playVod(modalVod), `https://kick.com/iabs/videos/${modalVod.uuid}`)}
                    </div>
                </div>
            )}
            {modalClip && (() => {
                const parent = vodById.get(modalClip.vodId);
                return (
                    <div className="ov on" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
                        <div className="md cut" role="dialog" aria-modal="true" aria-label={modalClip.t}>
                            {navBar('CLIP')}
                            <h3>{modalClip.t}</h3>
                            <div className="mm">
                                <span>{L('الصانع:', 'By:')} <b>{modalClip.by}</b></span>
                                <span><b data-n>{fmt(modalClip.v)}</b> {L('مشاهدة', 'views')}</span>
                                <span>{L('المدة:', 'Duration:')} <b dir="ltr">{hms(modalClip.dur)}</b></span>
                                {modalClip.at > 0 && <span>{L('اللحظة في التسجيل:', 'Moment in VOD:')} <b dir="ltr">{hm(modalClip.at / 60)}</b></span>}
                            </div>
                            <Tb h={modalClip.h} thumb={modalClip.thumb} cls="big" onPlay={() => playClip(modalClip)} label={`${L('تشغيل', 'Play')} ${modalClip.t}`}
                                badges={<>
                                    <span className="b a">CLIP</span>
                                    <span className="b c">{modalClip.by}</span>
                                    <span className="b d" dir="ltr">{fmt(modalClip.v)}</span>
                                </>} />
                            <div className="box">
                                <h5>{L('من بث', 'From stream')}</h5>
                                {parent ? (
                                    <>
                                        <div className="mm"><span><b>{parent.t}</b></span><span>{dateFmt(parent.ts)} · {durTxt(parent.min)}</span></div>
                                        <Cta pc="#6b78ff" icon="bolt" title={L('افتح تقرير الجلسة', 'Open session report')} sub={`${durTxt(parent.min)} · ${fmt(parent.v)} ${L('مشاهدة', 'views')}`}
                                            onClick={() => setModal({ k: 'v', id: String(parent.id) })} />
                                    </>
                                ) : <div className="mm"><span>{L('البث الأصلي غير متاح في الأرشيف.', 'The original stream is not in the archive.')}</span></div>}
                            </div>
                            {dockBar(`c${modalClip.id}`, '#ff2f3a', L('تشغيل اللقطة', 'Play the clip'), `${modalClip.by} · ${hms(modalClip.dur)}`, () => playClip(modalClip), `https://kick.com/iabs?clip=${modalClip.id}`)}
                        </div>
                    </div>
                );
            })()}
            {player && <Player item={player} onClose={() => setPlayer(null)} L={L} />}
            <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
        </div>,
        document.body
    ) : null;

    /* ---------- loading / failure ---------- */
    if (loadingData && !failed) {
        return (
            <div className="absa" aria-busy="true">
                <Head />
                <div className="stats">{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 74 }} />)}</div>
                <div className="sk" style={{ height: 380 }} />
                <div className="vg">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="sk" style={{ height: 260 }} />)}</div>
                {portal}
            </div>
        );
    }
    if (failed && !vods && !clips) {
        return (
            <div className="absa">
                <Head />
                <div className="empty">
                    {L('تعذّر تحميل الأرشيف من Kick.', 'Could not load the archive from Kick.')}
                    <div style={{ marginTop: 14 }}><button className="sbtn" onClick={load}><Ico k="back" />{L('إعادة المحاولة', 'Retry')}</button></div>
                </div>
                {portal}
            </div>
        );
    }

    const favCount = V.filter(v => favs.has(`v${v.id}`)).length + C.filter(c => favs.has(`c${c.id}`)).length;

    return (
        <div className="absa">
            <Head />
            <Rv className="stats">
                <div className="st cut"><b><Num value={V.length} /></b><span>{L('بث محفوظ', 'Saved VODs')}</span></div>
                <div className="st cut"><b><Num value={totViews} /></b><span>{L('إجمالي المشاهدات', 'Total views')}</span></div>
                <div className="st cut"><b><Num value={totHours} s="h" /></b><span>{L('ساعة بث', 'Hours streamed')}</span></div>
                <div className="st cut"><b><Num value={C.length} /></b><span>{L(`لقطة (${fmt(totClipViews)} مشاهدة)`, `Clips (${fmt(totClipViews)} views)`)}</span></div>
            </Rv>
            {featured && <Featured v={featured} />}
            <Rv className="tools">
                <div className="trow">
                    <label className="search cut">
                        <Ico k="search" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('ابحث في البثوث واللقطات أو اسم صانع اللقطة', 'Search VODs, clips or clip creator')} aria-label={L('بحث', 'Search')} />
                    </label>
                    <Seg label={L('النوع', 'Type')} value={ty} onChange={setTy} opts={[
                        { id: 'all', label: L('الكل', 'All') },
                        { id: 'vod', label: L('البثوث', 'VODs') },
                        { id: 'clip', label: L('اللقطات', 'Clips') },
                        { id: 'fav', label: L('المفضلة', 'Favorites'), badge: favCount },
                    ]} />
                </div>
                <div className="trow">
                    <Seg label={L('الفئة', 'Category')} value={cat} onChange={setCat} opts={[{ id: 'all', label: L('كل الفئات', 'All categories') }, ...cats.map(c => ({ id: c, label: c }))]} />
                    <span className="lbl" style={{ marginInlineStart: 'auto' }}>{L('الترتيب:', 'Sort:')}</span>
                    <Seg label={L('الترتيب', 'Sort')} value={srt} onChange={setSrt} opts={[
                        { id: 'new', label: L('الأحدث', 'Newest') },
                        { id: 'views', label: L('الأكثر مشاهدة', 'Most viewed') },
                        { id: 'long', label: L('الأطول', 'Longest') },
                    ]} />
                </div>
            </Rv>
            {ty !== 'clip' && (
                <Rv className="sec">
                    <div className="rh">
                        <span className="tt">VODS</span>
                        <h3>{L('البثوث السابقة', 'Past streams')}</h3>
                        <span className="ln" />
                        <span className="section-actions">
                            <small>{displayVods.length}{shownVods.length > 6 ? ` / ${shownVods.length}` : ''} {L('بث', 'VODs')}</small>
                            {shownVods.length > 6 && <button className="all-items" onClick={() => setShowAllVods(v => !v)}>{showAllVods ? L('إظهار الأقل', 'Show less') : L('جميع الفيديوهات', 'All videos')}</button>}
                        </span>
                    </div>
                    <div className="vg">
                        {displayVods.length ? displayVods.map(vodCard) : <div className="empty">{L('ما في بثوث مطابقة. جرّب كلمة ثانية أو غيّر الفلتر.', 'No matching VODs. Try another keyword or filter.')}</div>}
                    </div>
                </Rv>
            )}
            {ty !== 'vod' && (
                <Rv className="sec">
                    <div className="rh">
                        <span className="tt">CLIPS</span>
                        <h3>{L('آخر اللقطات', 'Latest clips')}</h3>
                        <span className="ln" />
                        <span className="section-actions">
                            <small>{displayClips.length}{shownClips.length > 9 ? ` / ${shownClips.length}` : ''} {L('لقطة', 'clips')}</small>
                            {shownClips.length > 9 && <button className="all-items" onClick={() => setShowAllClips(v => !v)}>{showAllClips ? L('إظهار الأقل', 'Show less') : L('جميع اللقطات', 'All clips')}</button>}
                        </span>
                    </div>
                    <div className="cg">
                        {displayClips.length ? displayClips.map((c, i) => clipCard(c, i, i === 0 && displayClips.length > 2)) : <div className="empty">{L('ما في لقطات مطابقة.', 'No matching clips.')}</div>}
                    </div>
                </Rv>
            )}
            {portal}
        </div>
    );
};

export default ArchiveSection;
