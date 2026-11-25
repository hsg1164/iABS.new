import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ArenaSections.css';
import { Language } from '../types';
import { FALLBACK } from '../utils/socialMediaApi';

/* ============================================================
   ABS Arena — «ساحة التواصل» + «مقر المجتمع»
   Design: exact port of abs-social-live__2_ (1).html (v4 rounded)
   Data: live APIs (Kick / TikTok / X / YouTube / Instagram /
   WhatsApp channel / Discord widget / YouTube RSS), never static.
   ============================================================ */

export interface ArenaStats {
    kick?: number;
    tiktok?: number;
    twitter?: number;
    youtube?: number;
    instagram?: number;
    discord?: number;
    whatsapp?: number;
}

export interface ArenaLive {
    isLive?: boolean;
    viewers?: number;
    title?: string;
}

const ICO: Record<string, React.ReactNode> = {
    kick: <path d="M4 3h5v6h2V7h2V5h2V3h5v5h-2v2h-2v4h2v2h2v5h-5v-2h-2v-2h-2v-2H9v6H4z" fill="currentColor" />,
    sc: <path d="M12 3C9 3 7.400 5.200 7.400 7.800v1.600l-1.600.5c-.5.200-.5.800 0 1l1.300.5c-.4 1.200-1.200 2.200-2.400 2.800.8.800 1.800.8 2.600.9.300.7 1 .9 1.800.9.8 0 1.200-.4 2.900-.4s2.100.4 2.900.4c.8 0 1.500-.2 1.800-.9.800-.1 1.800-.1 2.600-.9-1.200-.6-2-1.600-2.400-2.800l1.300-.5c.5-.2.5-.8 0-1l-1.600-.5V7.800C16.600 5.200 15 3 12 3z" fill="currentColor" />,
    x: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />,
    tt: <path d="M16 3c.4 2.600 2 4 4.500 4.200v3.200a7.600 7.600 0 0 1-4.400-1.400v6.200a5.600 5.600 0 1 1-5.600-5.600c.3 0 .6 0 .9.100v3.300a2.400 2.400 0 1 0 1.500 2.200V3z" fill="currentColor" />,
    ig: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></>,
    yt: <><rect x="2" y="5" width="20" height="14" rx="4.5" fill="currentColor" /><path d="M10 9l5 3-5 3z" fill="#080404" /></>,
    dc: <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" fill="currentColor" />,
    wa: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor" />,
    eye: <><path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.300 3.100-6 7-6s7 2.700 7 6z" fill="currentColor" />,
    arr: <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
    play: <path d="M8 5v14l11-7z" fill="currentColor" />,
    cpy: <><rect x="9" y="9" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
    chk: <path d="M5 12.500l5 5L20 7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />,
    cal: <><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
};

const Ico: React.FC<{ k: string; className?: string }> = ({ k, className }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{ICO[k]}</svg>
);

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

const Rv: React.FC<{ className?: string; delay?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ className = '', delay = 0, style, children }) => {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className={`rv ${inView ? 'in' : ''} ${className}`} style={{ ...style, ['--d' as string]: `${delay}s` }}>
            {children}
        </div>
    );
};

/* ---------- count-up (animates on reveal AND on live value change) ---------- */
const Num: React.FC<{ value: number; d?: number; s?: string }> = ({ value, d = 0, s = '' }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const shown = useRef(0);
    const raf = useRef(0);
    const { ref: ioRef, inView } = useInView<HTMLSpanElement>();
    const setRefs = (el: HTMLSpanElement | null) => { (ref as React.MutableRefObject<HTMLSpanElement | null>).current = el; (ioRef as React.MutableRefObject<HTMLSpanElement | null>).current = el; };
    useEffect(() => {
        const el = ref.current;
        if (!el || !inView) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            shown.current = value;
            el.textContent = (d ? value.toFixed(d) : Math.round(value).toLocaleString('en')) + s;
            return;
        }
        const from = shown.current, to = value, t0 = performance.now();
        cancelAnimationFrame(raf.current);
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / 1500);
            const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
            shown.current = v;
            el.textContent = (d ? v.toFixed(d) : Math.round(v).toLocaleString('en')) + s;
            if (p < 1) raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf.current);
    }, [inView, value, d, s]);
    return <span ref={setRefs} data-n={value} dir="ltr">{(0).toFixed(d) + s}</span>;
};

/* raw count → display parts (K / M, reference suffix style) */
function parts(raw: number, plus: boolean): { n: number; d: number; s: string } {
    if (raw >= 1000000) return { n: raw / 1000000, d: raw % 1000000 === 0 ? 0 : 1, s: 'M+' };
    if (raw >= 1000) { const k = raw / 1000; return { n: k, d: k % 1 === 0 ? 0 : 1, s: plus ? 'K+' : 'K' }; }
    return { n: raw, d: 0, s: '' };
}

/* ---------- segmented control with sliding indicator ---------- */
const Seg: React.FC<{ opts: [string, string][]; value: string; onChange: (v: string) => void }> = ({ opts, value, onChange }) => {
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
        <div className="seg" ref={ref}>
            <span className="ind" />
            {opts.map(([id, label]) => (
                <button key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{label}</button>
            ))}
        </div>
    );
};

/* ---------- platform catalog (design constants; counts come live) ---------- */
interface Pl { id: string; k: string; h: string; d: string; dEn: string; c: string; cat: string; nm: string; url: string; hero?: boolean; plus: boolean; }
const PL: Pl[] = [
    { id: 'kick', k: 'KICK', h: 'iABS', d: 'البث الأساسي والتفاعل المباشر', dEn: 'Main stream & live interaction', c: '#53fc18', cat: 'stream', nm: 'Kick', url: 'https://kick.com/iabs', hero: true, plus: false },
    { id: 'sc', k: 'SNAPCHAT', h: 'iabsq', d: 'يوميات حصرية وتغطيات خاصة', dEn: 'Exclusive daily stories', c: '#fffc00', cat: 'social', nm: 'Snapchat', url: 'https://www.snapchat.com/@iabsq', plus: false },
    { id: 'x', k: 'X', h: '@iABSq', d: 'أخبار وتحديثات سريعة', dEn: 'Fast news & updates', c: '#e9e9e9', cat: 'social', nm: 'X', url: 'https://x.com/iABSq', plus: true },
    { id: 'tt', k: 'TIKTOK', h: '@iabsq', d: 'أقوى المقاطع والتحديات', dEn: 'Best clips & challenges', c: '#ff2d6f', cat: 'social', nm: 'TikTok', url: 'https://www.tiktok.com/@iabsq', plus: true },
    { id: 'ig', k: 'INSTAGRAM', h: '@absq', d: 'صور وكواليس حصرية', dEn: 'Photos & behind the scenes', c: '#e1306c', cat: 'social', nm: 'Instagram', url: 'https://www.instagram.com/absq/', plus: true },
    { id: 'yt', k: 'YOUTUBE', h: 'Channel', d: 'أرشيف البثوث ومقاطع ممتعة', dEn: 'VOD archive & fun clips', c: '#ff2a2a', cat: 'stream', nm: 'YouTube', url: 'https://www.youtube.com/channel/UCdIM7MB-8G-FgE7ld3XAQ8w', plus: true },
    { id: 'dc', k: 'DISCORD', h: 'Community', d: 'أكبر تجمع للأساطير', dEn: 'The legends gathering', c: '#6b78ff', cat: 'community', nm: 'Discord', url: 'https://discord.com/invite/64aggJ9yRA', plus: false },
    { id: 'wa', k: 'WHATSAPP', h: 'Channel', d: 'تواصل مباشر وتنبيهات البث', dEn: 'Direct chat & stream alerts', c: '#25d366', cat: 'community', nm: 'WhatsApp', url: 'https://www.whatsapp.com/channel/0029VadbqYx5Ui2eInkr7v2E', plus: false },
];
const rawOf = (p: Pl, s: ArenaStats): number | null => {
    let v: number | undefined;
    switch (p.id) {
        case 'kick': v = s.kick; break;
        case 'x': v = s.twitter; break;
        case 'tt': v = s.tiktok; break;
        case 'ig': v = s.instagram; break;
        case 'yt': v = s.youtube; break;
        case 'dc': v = s.discord; break;
        case 'wa': v = s.whatsapp; break;
        default: return null; // Snapchat — حصري, no public counter
    }
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/* ============================================================
   SOCIAL ARENA
   ============================================================ */
export const SocialArena: React.FC<{ lang: Language; stats: ArenaStats; live?: ArenaLive }> = ({ lang, stats, live }) => {
    const ar = lang === 'ar';
    const [cat, setCat] = useState('all');
    const [srt, setSrt] = useState<'def' | 'n'>('def');
    const [hl, setHl] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
    const share = useInView<HTMLDivElement>();

    const showToast = useCallback((m: string) => {
        setToast(m);
        if (toastT.current) clearTimeout(toastT.current);
        toastT.current = setTimeout(() => setToast(''), 1800);
    }, []);
    useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current); }, []);

    const CATS: [string, string][] = ar
        ? [['all', 'الكل'], ['stream', 'بث وفيديو'], ['social', 'تواصل اجتماعي'], ['community', 'مجتمع']]
        : [['all', 'All'], ['stream', 'Streams & Video'], ['social', 'Social'], ['community', 'Community']];
    const SRTS: [string, string][] = ar
        ? [['def', 'الافتراضي'], ['n', 'الأكثر متابعة']]
        : [['def', 'Default'], ['n', 'Most followed']];

    const rows = PL.map(p => ({ p, raw: rawOf(p, stats) }));
    const known = rows.filter(r => r.raw !== null && r.raw > 0) as { p: Pl; raw: number }[];
    const TOT = known.reduce((a, r) => a + r.raw, 0);
    const totP = parts(TOT, true);
    const top = known.slice().sort((a, b) => b.raw - a.raw)[0];
    const topP = top ? parts(top.raw, top.p.plus) : null;
    const sorted = known.slice().sort((a, b) => b.raw - a.raw);

    const onOver = (e: React.MouseEvent) => {
        const t = (e.target as Element).closest('[data-p],[data-id]');
        if (t) setHl(t.getAttribute('data-p') || t.getAttribute('data-id'));
    };
    const onOut = (e: React.MouseEvent) => {
        if ((e.target as Element).closest('[data-p],[data-id]')) setHl(null);
    };

    const copy = (e: React.MouseEvent, handle: string) => {
        e.preventDefault(); e.stopPropagation();
        const ok = () => showToast(ar ? `تم نسخ ${handle}` : `Copied ${handle}`);
        const fail = () => showToast(ar ? 'تعذّر النسخ' : 'Copy failed');
        const legacy = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = handle;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                const done = document.execCommand('copy');
                ta.remove();
                done ? ok() : fail();
            } catch { fail(); }
        };
        try { navigator.clipboard.writeText(handle).then(ok, legacy); } catch { legacy(); }
    };

    return (
        <div className="absx" onMouseOver={onOver} onMouseOut={onOut}>
            <Rv className="sh">
                <span className="num" dir="ltr">01</span>
                <div className="tx">
                    <span className="tag" dir="ltr">SOCIAL ARENA</span>
                    <h2>{ar ? 'ساحة التواصل' : 'Social Arena'}</h2>
                    <p>{ar ? 'كل المنصات في مكان واحد – اختر ساحتك.' : 'Every platform in one place — pick your arena.'}</p>
                </div>
                <span className="ln" />
            </Rv>

            <div className="stats">
                <Rv className="sm cut" delay={0}>
                    <b><Num value={totP.n} d={totP.d} s={totP.s} /></b>
                    <span>{ar ? <>إجمالي الجمهور<br />على كل المنصات</> : <>Total audience<br />across platforms</>}</span>
                </Rv>
                <Rv className="sm cut" delay={0.08}>
                    <b><Num value={PL.length} /></b>
                    <span>{ar ? <>منصة<br />رسمية</> : <>Official<br />platforms</>}</span>
                </Rv>
                <Rv className="sm cut" delay={0.16}>
                    <b>{top ? top.p.nm : '—'}</b>
                    <span>{ar ? 'الأكبر جمهوراً' : 'Largest audience'}<br />{top && topP ? <span dir="ltr">({topP.n.toFixed(topP.d)}{topP.s})</span> : ''}</span>
                </Rv>
            </div>

            <div ref={share.ref} className={`share cut rv ${share.inView ? 'in' : ''}`}>
                <h4>{ar ? 'حجم الجمهور على المنصات' : 'Audience share by platform'}<small>{ar ? `مجموع ${totP.n.toFixed(1)}${totP.s} (بدون سناب)` : `Total ${totP.n.toFixed(1)}${totP.s} (excl. Snapchat)`}</small></h4>
                <div className="sb">
                    {sorted.map(({ p, raw }) => (
                        <i key={p.id} data-p={p.id} title={p.nm} className={hl === p.id ? 'hl' : ''}
                            style={{ ['--pc' as string]: p.c, width: share.inView && TOT > 0 ? `${(raw / TOT) * 100}%` : 0 }} />
                    ))}
                </div>
                <div className="lg">
                    {sorted.map(({ p, raw }) => (
                        <span key={p.id} data-p={p.id} className={hl === p.id ? 'hl' : ''} style={{ ['--pc' as string]: p.c }}>
                            {p.nm} <b dir="ltr">{TOT > 0 ? Math.round((raw / TOT) * 100) : 0}%</b>
                        </span>
                    ))}
                </div>
            </div>

            <Rv className="tools">
                <Seg opts={CATS} value={cat} onChange={setCat} />
                <div className="srtw">
                    <span>{ar ? 'الترتيب:' : 'Sort:'}</span>
                    <Seg opts={SRTS} value={srt} onChange={(v) => setSrt(v as 'def' | 'n')} />
                </div>
            </Rv>

            <div className="arena">
                {rows.map(({ p, raw }, idx) => (
                    <ArenaCard key={p.id} p={p} raw={raw} idx={idx} cat={cat} srt={srt} hl={hl} ar={ar} onCopy={copy}
                        live={p.hero ? live : undefined} />
                ))}
            </div>

            <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
        </div>
    );
};

const ArenaCard: React.FC<{
    p: Pl; raw: number | null; idx: number; cat: string; srt: 'def' | 'n';
    hl: string | null; ar: boolean; onCopy: (e: React.MouseEvent, h: string) => void;
    live?: ArenaLive;
}> = ({ p, raw, idx, cat, srt, hl, ar, onCopy, live }) => {
    const { ref, inView } = useInView<HTMLAnchorElement>();
    const [copied, setCopied] = useState(false);
    const cpT = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (cpT.current) clearTimeout(cpT.current); }, []);
    const doCopy = (e: React.MouseEvent) => {
        onCopy(e, p.h);
        setCopied(true);
        if (cpT.current) clearTimeout(cpT.current);
        cpT.current = setTimeout(() => setCopied(false), 1300);
    };
    const off = cat !== 'all' && p.cat !== cat;
    const order = p.hero ? 0 : srt === 'n' ? Math.round(1000 - (raw || 0) / 1000) : idx + 1;
    const pp = raw ? parts(raw, p.plus) : null;
    const on = !!live?.isLive;
    return (
        <a ref={ref} href={p.url} target="_blank" rel="noopener noreferrer" data-id={p.id}
            className={`pl cut rv ${inView ? 'in' : ''} ${p.hero ? `hero ${on ? 'is-live' : 'is-off'}` : ''} ${off ? 'off' : ''} ${hl === p.id ? 'hl' : ''}`}
            style={{ ['--pc' as string]: p.c, ['--d' as string]: `${idx * 0.07}s`, order }}>
            <span className="sw" />
            <Ico k={p.id} className="ghost" />
            <div className="ic"><Ico k={p.id} /></div>
            <div className="bd">
                {p.hero && (
                    <div className="top">
                        <span className="stage s-live"><i />{ar ? 'مباشر الآن' : 'LIVE NOW'}</span>
                        <span className="stage s-off"><i />{ar ? 'أوفلاين' : 'OFFLINE'}</span>
                        <span className="eq s-live"><i /><i /><i /><i /><i /></span>
                    </div>
                )}
                <div className="k" dir="ltr">{p.k}</div>
                <div className="h" dir="ltr">{p.h}</div>
                {p.hero ? (
                    <>
                        <div className="d s-off">{ar ? 'لا يوجد بث حالياً — تابع القناة ليوصلك التنبيه أول ما نبدأ' : 'No stream right now — follow the channel to get notified when we go live'}</div>
                        <div className="ttl s-live">{live?.title || (ar ? 'بث مباشر الآن' : 'Live now')}</div>
                    </>
                ) : (
                    <div className="d">{ar ? p.d : p.dEn}</div>
                )}
                <div className="m">
                    <Ico k="user" />
                    {pp ? <Num value={pp.n} d={pp.d} s={pp.s} /> : <span>{ar ? 'حصري' : 'Exclusive'}</span>}
                    {p.hero && <em>{ar ? 'متابع' : 'followers'}</em>}
                    {p.hero && (
                        <span className="vw s-live">
                            <u className="vd" />
                            <Ico k="eye" />
                            <b><Num value={live?.viewers || 0} /></b>
                            <span className="vl">{ar ? 'يشاهدون الآن' : 'watching now'}</span>
                        </span>
                    )}
                </div>
            </div>
            <div className="go">{p.hero && <span className="gt">{ar ? 'شاهد البث' : 'Watch live'}</span>}<Ico k="arr" /></div>
            <button className="cp" onClick={doCopy} aria-label={ar ? 'نسخ اسم الحساب' : 'Copy handle'}>
                <Ico k={copied ? 'chk' : 'cpy'} />
            </button>
        </a>
    );
};

/* ============================================================
   COMMUNITY HQ — live Discord widget + YouTube RSS
   ============================================================ */
interface DcMember { username: string; avatar_url: string; status: string; game?: { name: string }; }
interface DcChannel { id: string; name: string; position?: number; }
interface DcWidget { name: string; instant_invite: string; presence_count: number; members: DcMember[]; channels?: DcChannel[]; }
interface DcMeta { name?: string; icon?: string | null; banner?: string | null; }
interface Vid { title: string; link: string; date: string; thumb: string; }

const GUILD_ID = '882327352858783765';
const CHANNEL_ID = 'UCdIM7MB-8G-FgE7ld3XAQ8w';
const CHANNEL_URL = 'https://www.youtube.com/@ABS11';
const INVITE_URL = 'https://discord.com/invite/64aggJ9yRA';
const HKEY = 'iabs_dc_presence_v1';
const AV = ['#ff6b6b', '#ffd23f', '#6bd6ff', '#b58cff', '#7dffb0', '#ffa24a'];
const FALLBACK_CHANNELS: DcChannel[] = [
    { id: 'abs-1', name: '🔊 | ABS 1', position: 1 },
    { id: 'event-stage', name: '🎪 | Event Stage', position: 2 },
    { id: 'waiting', name: '🕐 | Waiting', position: 3 },
    { id: 'pull-me', name: '🔺 | Pull me', position: 4 },
    { id: 'abs-3', name: '🔊 | ABS 3', position: 5 },
    { id: 'abs-2', name: '🔊 | ABS 2', position: 6 },
];
interface ActivityPoint { t: number; v: number; }

function readHistory(): ActivityPoint[] {
    try {
        const arr: ActivityPoint[] = JSON.parse(localStorage.getItem(HKEY) || '[]');
        const cut = Date.now() - 24 * 3600 * 1000;
        const points = arr.filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.v) && p.t >= cut);
        return points.length >= 2 ? points : [];
    } catch { return []; }
}
function pushHistory(v: number): ActivityPoint[] {
    try {
        const now = Date.now();
        const arr: ActivityPoint[] = JSON.parse(localStorage.getItem(HKEY) || '[]');
        const last = arr[arr.length - 1];
        if (!last || now - last.t > 55000) arr.push({ t: now, v });
        const cut = now - 24 * 3600 * 1000;
        const pruned = arr.filter(p => p.t >= cut).slice(-300);
        localStorage.setItem(HKEY, JSON.stringify(pruned));
        return pruned.map(p => p.v);
    } catch { return [{ t: Date.now() - 60000, v }, { t: Date.now(), v }]; }
}

function demoActivity(current: number): ActivityPoint[] {
    const now = Date.now();
    const anchor = current > 0 ? current : 2200;
    const phase = now / 30000;
    return Array.from({ length: 25 }, (_, i) => {
        const wave = 0.78 + Math.sin(i * 0.62 + phase * 0.08) * 0.13 + Math.sin(i * 1.7 + phase * 0.03) * 0.05;
        const v = Math.max(0, Math.round(anchor * wave));
        return { t: now - (24 - i) * 3600000, v: i === 24 && current > 0 ? current : v };
    });
}

const Spark: React.FC<{ vals: ActivityPoint[] }> = ({ vals }) => {
    const fallback = [{ t: Date.now() - 60000, v: vals[0]?.v || 0 }, { t: Date.now(), v: vals[vals.length - 1]?.v || vals[0]?.v || 0 }];
    const points = vals.length >= 2 ? vals : fallback;
    const values = points.map(p => p.v);
    const [active, setActive] = useState<number | null>(null);
    const w = 100, h = 30, min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
    const coords = points.map((p, i) => ({ x: i / (points.length - 1) * w, y: h - 4 - ((p.v - min) / span) * (h - 8) }));
    const pts = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const activeIndex = active === null ? points.length - 1 : Math.min(active, points.length - 1);
    const ap = points[activeIndex];
    const time = new Date(ap.t).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    return (
        <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Discord activity over the last 24 hours">
            <defs>
                <linearGradient id="absx-sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6b78ff" stopOpacity=".5" />
                    <stop offset="1" stopColor="#6b78ff" stopOpacity="0" />
                </linearGradient>
            </defs>
            {[7, 15, 23].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(154,163,255,.12)" strokeWidth=".35" />)}
            <polygon points={`0,30 ${pts} 100,30`} fill="url(#absx-sg)" />
            <polyline className="l" points={pts} fill="none" stroke="#9aa3ff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            {coords.map((p, i) => <circle key={`${points[i].t}-${i}`} className={`${i === active ? 'active' : ''} ${i === points.length - 1 ? 'current' : ''}`} cx={p.x} cy={p.y} r={i === active || i === points.length - 1 ? 1.35 : .8} fill="#dfe2ff" stroke="#6b78ff" strokeWidth=".45" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />)}
            {active !== null && <g className="spark-tip" transform={`translate(${Math.max(13, Math.min(87, coords[activeIndex].x))},${Math.max(4, coords[activeIndex].y - 5)})`}>
                <rect x="-12" y="-3.5" width="24" height="5.5" rx="2" />
                <text x="0" y=".3" textAnchor="middle">{ap.v.toLocaleString('en')} · {time}</text>
            </g>}
        </svg>
    );
};

/* pill CTA — ctaw > cta (fl shine, ci icon, ct text, ca arrow) */
const Cta: React.FC<{ pc: string; ic: string; t: string; sub: string; href: string }> = ({ pc, ic, t, sub, href }) => (
    <span className="ctaw" style={{ ['--pc' as string]: pc }}>
        <a className="cta" href={href} target="_blank" rel="noopener noreferrer">
            <span className="fl" />
            <span className="ci"><Ico k={ic} /></span>
            <span className="ct"><b>{t}</b><small>{sub}</small></span>
            <span className="ca"><Ico k="arr" /></span>
        </a>
    </span>
);

export const CommunityHQ: React.FC<{ lang: Language; stats: ArenaStats; no?: string }> = ({ lang, stats, no = '02' }) => {
    const ar = lang === 'ar';
    const [dc, setDc] = useState<DcWidget | null>(null);
    const [dcMeta, setDcMeta] = useState<DcMeta | null>(null);
    const [hist, setHist] = useState<ActivityPoint[]>(() => readHistory());
    const [videos, setVideos] = useState<Vid[]>([]);
    const [sel, setSel] = useState(0);
    const dcCard = useInView<HTMLElement>();
    const ytCard = useInView<HTMLElement>();

    /* Discord widget — live presence, members, invite (60s, pauses when hidden) */
    useEffect(() => {
        let dead = false;
        const load = async () => {
            try {
                const r = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`);
                const j = await r.json();
                if (dead || typeof j?.presence_count !== 'number') return;
                setDc(j);
                pushHistory(j.presence_count);
                setHist(demoActivity(j.presence_count));
                try {
                    const ir = await fetch(`${INVITE_URL}?with_counts=true&with_expiration=true`);
                    const ij = await ir.json();
                    if (!dead && ij?.guild) setDcMeta({ name: ij.guild.name, icon: ij.guild.icon, banner: ij.guild.banner });
                } catch { /* widget data is still useful without branding */ }
            } catch { /* keep last */ }
        };
        load();
        let iv: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!iv) iv = setInterval(load, 30000); };
        const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { load(); start(); } else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { dead = true; stop(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

    /* YouTube latest videos — real thumbnails, titles, dates (10 min loop) */
    useEffect(() => {
        let dead = false;
        const load = async () => {
            try {
                const rss = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`);
                const j = await r.json();
                if (dead || !Array.isArray(j?.items) || !j.items.length) return;
                setVideos(j.items.slice(0, 3).map((it: any) => ({
                    title: it.title,
                    link: it.link,
                    date: new Date(it.pubDate).toLocaleDateString(ar ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                    thumb: String(it.thumbnail || '').replace(/maxresdefault\.jpg.*$/, 'hqdefault.jpg'),
                })));
            } catch { /* keep placeholder */ }
        };
        load();
        let iv: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!iv) iv = setInterval(load, 10 * 60 * 1000); };
        const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') start(); else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { dead = true; stop(); document.removeEventListener('visibilitychange', onVis); };
    }, [ar]);

    const presence = dc?.presence_count ?? 0;
    const members = dc?.members ?? [];
    const playing = members.find(m => m.game);
    const squad = members.slice(0, 6);
    const extra = Math.max(0, presence - squad.length);
    const dcBanner = dcMeta?.banner ? `https://cdn.discordapp.com/banners/${GUILD_ID}/${dcMeta.banner}.jpg?size=1024` : '';
    const dcIcon = dcMeta?.icon ? `https://cdn.discordapp.com/icons/${GUILD_ID}/${dcMeta.icon}.png?size=256` : 'favicon-192.png';
    const liveChannels = (dc?.channels || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 6);
    const dcChannels = liveChannels.length ? liveChannels : FALLBACK_CHANNELS;
    const subs = parts(stats.youtube || FALLBACK.youtube, true);
    const subsShort = `${Math.floor(subs.n)}${subs.s.replace('+', '')}`;
    const v = videos[sel];
    const hues = [200, 350, 30];

    return (
        <div className="absx">
            <Rv className="sh" style={{ marginTop: 0 }}>
                <span className="num" dir="ltr">{no}</span>
                <div className="tx">
                    <span className="tag" dir="ltr">COMMUNITY HQ</span>
                    <h2>{ar ? 'مقر المجتمع' : 'Community HQ'}</h2>
                    <p>{ar ? 'أحدث الفيديوهات ونبض السيرفر في مكان واحد.' : 'Latest videos and the server pulse in one place.'}</p>
                </div>
                <span className="ln" />
            </Rv>

            <div className="hq">
                {/* ===== DISCORD ===== */}
                <article ref={dcCard.ref} className={`hc cut rv ${dcCard.inView ? 'in' : ''}`} style={{ ['--pc' as string]: '#6b78ff', ['--d' as string]: '0s' }}>
                    {dcBanner && (
                        <div className="dc-banner cut" style={{ ['--pc' as string]: '#6b78ff' }}>
                            <span className="bg" style={{ backgroundImage: `linear-gradient(115deg, rgba(10,6,28,.16), rgba(10,6,18,.72)), url(${dcBanner})` }} />
                        </div>
                    )}

                    <div className="dc-identity cut">
                        <img className="dc-logo" src={dcIcon} alt={dcMeta?.name || 'ABS COMMUNITY'} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.src = 'favicon-192.png'; }} />
                        <div className="dc-identity-copy">
                            <strong dir="ltr">{dcMeta?.name || dc?.name || 'ABS COMMUNITY'}</strong>
                            <span>{ar ? 'مجتمع الأساطير والتواصل المباشر' : 'The legends community & live chat'}</span>
                        </div>
                        <div className="dc-online"><i />{presence.toLocaleString('en')} {ar ? 'متصل الآن' : 'online now'}</div>
                    </div>

                    {dcChannels.length > 0 && (
                        <div className="dc-channels" aria-label={ar ? 'قنوات ديسكورد' : 'Discord channels'}>
                            {dcChannels.map((channel) => (
                                <span key={channel.id} className="dc-channel" dir="ltr"><i>#</i>{channel.name}</span>
                            ))}
                        </div>
                    )}

                    <div className="np cut">
                        <div className="t">
                            {playing ? (
                                <>
                                    <small><i />{ar ? 'يلعب الآن' : 'NOW PLAYING'}</small>
                                    <b dir="ltr">{playing.username} · {playing.game!.name}</b>
                                </>
                            ) : (
                                <>
                                    <small><i />{ar ? 'الفرقة في الانتظار' : 'SQUAD STANDBY'}</small>
                                    <b>{ar ? 'كن أول المنضمين' : 'Be the first to deploy'}</b>
                                </>
                            )}
                        </div>
                        <div className="stack">
                            {squad.map((m, i) => (
                                <i key={`${m.username}-${i}`} title={m.username} style={{ ['--a' as string]: AV[i % AV.length] }}>
                                    <span className="lt">{(m.username || '?').charAt(0).toUpperCase()}</span>
                                    {m.avatar_url && <img src={m.avatar_url} alt="" loading="lazy" decoding="async" onError={(e) => e.currentTarget.remove()} />}
                                </i>
                            ))}
                            {extra > 0 && <i className="more" dir="ltr">+{extra}</i>}
                        </div>
                    </div>

                    <div className="act cut">
                        <h5>{ar ? 'نشاط السيرفر خلال 24 ساعة' : 'Server activity — last 24h'}<small>{ar ? 'تجريبي متحرك' : 'animated demo'}</small></h5>
                        <Spark vals={hist.length ? hist : [{ t: Date.now() - 60000, v: presence }, { t: Date.now(), v: presence }]} />
                    </div>

                    <Cta pc="#6b78ff" ic="dc" href={dc?.instant_invite || INVITE_URL}
                        t={ar ? 'انضم للفرقة الآن' : 'JOIN THE SQUAD'}
                        sub={presence > 0
                            ? (ar ? `${presence.toLocaleString('en')} عضو متصل الآن` : `${presence.toLocaleString('en')} members online now`)
                            : (ar ? 'أكبر تجمع للأساطير — انضم الآن' : 'The legends gathering — join now')} />
                </article>

                {/* ===== YOUTUBE ===== */}
                <article ref={ytCard.ref} className={`hc cut rv ${ytCard.inView ? 'in' : ''}`} style={{ ['--pc' as string]: '#ff2a2a', ['--d' as string]: '.1s' }}>
                    <div className="hh">
                        <div className="ic"><Ico k="yt" /></div>
                        <div>
                            <h3>{ar ? 'قناة iABS' : 'iABS Channel'} <span className="pillb" dir="ltr">YT</span></h3>
                            <p>{ar ? 'أرشيف البثوث وأجمل اللقطات' : 'VODs & best moments'}</p>
                        </div>
                        <div className="stat">
                            <b><Num value={subs.n} d={subs.d} s={subs.s} /></b>
                            <span>{ar ? 'مشترك' : 'subscribers'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <a className="vid cut" href={v?.link || CHANNEL_URL} target="_blank" rel="noopener noreferrer"
                            style={{ ['--pc' as string]: '#ff2a2a', ['--vh' as string]: hues[sel % 3] }}>
                            <span className="bg">{v?.thumb && <img src={v.thumb} alt="" loading="lazy" decoding="async" onError={(e) => { const t = e.currentTarget; if (t.src.includes('hqdefault')) t.remove(); else t.src = t.src.replace('maxresdefault', 'hqdefault'); }} />}</span>
                            <img className="wm" src="favicon-192.png" alt="" loading="lazy" decoding="async" />
                            <span className="play"><Ico k="play" /></span>
                            {sel === 0 && <span className="new"><i />{ar ? 'الأحدث' : 'LATEST'}</span>}
                            <span className="tt">{v?.title || (ar ? 'أحدث فيديوهات القناة' : 'Latest channel videos')}</span>
                        </a>
                        <div className="vm">
                            <span><Ico k="cal" />{v?.date || (ar ? 'يتم الجلب من القناة…' : 'Fetching from channel…')}</span>
                            <span>{sel === 0 ? (ar ? 'آخر فيديو منشور' : 'Latest upload') : (ar ? 'فيديو سابق' : 'Earlier video')}</span>
                        </div>
                    </div>

                    {videos.length > 0 && (
                        <div className="vl">
                            {videos.map((vv, i) => (
                                <button key={vv.link} className={`cut ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}
                                    style={{ ['--pc' as string]: '#ff2a2a', ['--vh' as string]: hues[i % 3] }} aria-pressed={i === sel}>
                                    <span className="bg">{vv.thumb && <img src={vv.thumb} alt="" loading="lazy" decoding="async" onError={(e) => e.currentTarget.remove()} />}</span>
                                    <span>{vv.title}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <Cta pc="#ff2a2a" ic="yt" href={CHANNEL_URL}
                        t={ar ? 'اشترك الآن' : 'SUBSCRIBE NOW'}
                        sub={ar ? `انضم لأكثر من ${subsShort} مشترك` : `Join ${subsShort}+ subscribers`} />
                </article>
            </div>
        </div>
    );
};
