import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './HomeHero.css';
import { Language, SocialLink } from '../types';
import { DiscordIcon, KickIcon } from './Icons';

/* ============================================================
   ABS Home â€” exact port of Â«abs-home (8).htmlÂ»
   Sticky nav + hero + ticker, wired to live Kick data.
   ============================================================ */

interface HomeHeroProps {
  lang: Language;
  isLive: boolean;
  followers: number;
  visits: number;
  platforms: number;
  logo: string;
  socials: SocialLink[];
  onToggleLang: () => void;
  onRefresh: () => Promise<void> | void;
  onArchive: () => void;
}

type NavKey = 'social' | 'stream' | 'support' | 'schedule' | 'archive';

interface NavItem {
  k: NavKey;
  href: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}

const NAV: NavItem[] = [
  { k: 'social', href: '#socials', ar: 'التواصل', en: 'Social', descAr: 'كل المنصات والحسابات الرسمية في مكان واحد.', descEn: 'All official platforms in one place.' },
  { k: 'stream', href: '#live', ar: 'البث', en: 'Stream', descAr: 'شاهد البث المباشر وتفاعل مع المجتمع.', descEn: 'Watch the live stream and join the community.' },
  { k: 'support', href: '#support', ar: 'الدعم', en: 'Support', descAr: 'ادعم القناة عبر Streamlabs أو Creators.', descEn: 'Support the channel via Streamlabs or Creators.' },
  { k: 'schedule', href: '#schedule', ar: 'الجدول', en: 'Schedule', descAr: 'مواعيد البثوث والفعاليات القادمة.', descEn: 'Upcoming streams and events.' },
  { k: 'archive', href: '#archive60', ar: 'الأرشيف', en: 'Archive', descAr: 'كل البثوث السابقة واللقطات وتقارير الجلسات.', descEn: 'Past streams, clips and session reports.' },
];

const NAV_ICONS: Record<NavKey, React.ReactNode> = {
  social: (
    <>
      <circle cx="6" cy="12" r="2.8" />
      <circle cx="18" cy="6" r="2.8" />
      <circle cx="18" cy="18" r="2.8" />
      <path d="m8.5 10.8 7-3.5M8.5 13.2l7 3.5" />
    </>
  ),
  stream: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="3" />
      <path d="m10.5 8.5 4 2.5-4 2.5zM8 21h8M12 17v4" />
    </>
  ),
  support: (
    <path d="M12 20s-7-4.5-9-9.2C1.8 7 4.2 4 7.3 4c1.9 0 3.5 1 4.7 2.8C13.2 5 14.8 4 16.7 4 19.8 4 22.2 7 21 10.8 19 15.5 12 20 12 20z" />
  ),
  schedule: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v3l2 1" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
    </>
  ),
};

const NavIcon: React.FC<{ k: NavKey; strokeWidth?: number }> = ({ k, strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {NAV_ICONS[k]}
  </svg>
);

const formatK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));

/* Count-up that animates from the previous value to the new one. */
const useCountUp = (value: number, duration = 1600): number => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;
    if (from === to) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
      fromRef.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
};

const CountNum: React.FC<{ value: number; decimals?: number; suffix?: string; group?: boolean }> = ({
  value,
  decimals = 0,
  suffix = '',
  group = false,
}) => {
  const v = useCountUp(value);
  const text = group
    ? Math.round(v).toLocaleString('en-US')
    : decimals > 0
      ? v.toFixed(decimals)
      : String(Math.round(v));
  return (
    <>
      {text}
      {suffix}
    </>
  );
};

/* ---------- generated hero art ---------- */
interface Spark {
  x: number;
  y: number;
  r: number;
  delay: number;
  dur: number;
}

const useArt = () => {
  return useMemo(() => {
    const hex: string[] = [];
    const r = 34;
    for (let row = -9; row <= 9; row += 1) {
      for (let col = -9; col <= 9; col += 1) {
        const cx = 320 + col * r * 1.5;
        const cy = 320 + row * r * 1.732 + (col % 2 ? r * 0.866 : 0);
        if (Math.hypot(cx - 320, cy - 320) > 300) continue;
        let p = '';
        for (let k = 0; k < 6; k += 1) {
          const an = (Math.PI / 3) * k;
          p += `${(cx + Math.cos(an) * (r - 2)).toFixed(1)},${(cy + Math.sin(an) * (r - 2)).toFixed(1)} `;
        }
        hex.push(p);
      }
    }

    const ticks: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < 72; i += 1) {
      const a = (i * 5 * Math.PI) / 180;
      const l = i % 6 === 0 ? 18 : 9;
      ticks.push({
        x1: Number((320 + Math.cos(a) * 278).toFixed(1)),
        y1: Number((320 + Math.sin(a) * 278).toFixed(1)),
        x2: Number((320 + Math.cos(a) * (278 - l)).toFixed(1)),
        y2: Number((320 + Math.sin(a) * (278 - l)).toFixed(1)),
      });
    }

    const orb: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i * 60 * Math.PI) / 180;
      const ox = 320 + Math.cos(a) * 300;
      const oy = 320 + Math.sin(a) * 300;
      let p = '';
      for (let k = 0; k < 6; k += 1) {
        const an = (Math.PI / 3) * k;
        p += `${(ox + Math.cos(an) * 9).toFixed(1)},${(oy + Math.sin(an) * 9).toFixed(1)} `;
      }
      orb.push(p);
    }

    const sparks: Spark[] = [];
    for (let i = 0; i < 16; i += 1) {
      sparks.push({
        x: Math.round(140 + Math.random() * 360),
        y: Math.round(300 + Math.random() * 260),
        r: Number((1.5 + Math.random() * 2.6).toFixed(1)),
        delay: Number((Math.random() * 5).toFixed(2)),
        dur: Number((3.5 + Math.random() * 3).toFixed(1)),
      });
    }

    return { hex, ticks, orb, sparks };
  }, []);
};

const HomeHero: React.FC<HomeHeroProps> = ({
  lang,
  isLive,
  followers,
  visits,
  platforms,
  logo,
  socials,
  onToggleLang,
  onRefresh,
  onArchive,
}) => {
  const ar = lang === 'ar';
  const rootRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLElement>(null);
  const latRef = useRef<HTMLElement>(null);
  const toastTimer = useRef(0);

  const [ind, setInd] = useState({ left: 0, width: 0, on: false });
  const [drawer, setDrawer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');

  const art = useArt();

  const t = {
    hub: ar ? 'مركز iABS للبث المباشر' : 'iABS STREAM HUB',
    off: ar ? 'غير متصل حالياً' : 'Currently offline',
    live: ar ? 'مباشر الآن' : 'Live now',
    arch: ar ? 'أرشيف' : 'ARCHIVE',
    state: ar ? 'الحالة' : 'STATUS',
    pill: ar ? 'ملك القبول والاستمرارية لحياة أفضل' : 'King of acceptance and consistency for a better life',
    who: ar ? 'محمد القحطاني' : 'Mohammed Al-Qahtani',
    t1: ar ? '#ألعاب' : '#Gaming',
    t2: ar ? '#سوالف' : '#Chat',
    t3: ar ? '#بث يومي' : '#Daily stream',
    watch: ar ? 'شاهد البث' : 'Watch live',
    disc: ar ? 'انضم للديسكورد' : 'Join Discord',
    s1: ar ? 'منصة' : 'Platforms',
    s2: ar ? 'زيارة للموقع' : 'Site visits',
    s3: ar ? 'متابع كيك' : 'Kick followers',
    exp: ar ? 'استكشف الموقع' : 'Explore the site',
    expp: ar ? 'كل أقسام iABS في مكان واحد.' : 'Every iABS section in one place.',
    rights: ar ? '© iABS — جميع الحقوق محفوظة' : '© iABS — All rights reserved',
  };

  const status = isLive ? t.live : t.off;
  const followersText = formatK(followers);

  const tickerItems = ar
    ? ['بث يومي مباشر', 'ملك القبول', 'مجتمع الأساطير', 'تفاعل لا يتوقف', 'جوائز ودروبـس', 'ألعاب وتحديات']
    : ['Daily live stream', 'King of acceptance', 'Legends community', 'Non-stop interaction', 'Prizes & drops', 'Games & challenges'];

  const ticker = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2000);
  }, []);

  /* reveal */
  useEffect(() => {
    const t0 = window.setTimeout(() => {
      rootRef.current?.querySelectorAll('.rv, .ae-rv').forEach((el) => el.classList.add('in'));
    }, 60);
    return () => window.clearTimeout(t0);
  }, []);

  /* body lock while the drawer is open */
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  /* escape closes the drawer */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* Measure frame rate only while the visitor is scrolling. An always-on RAF
     loop needlessly kept every device awake, even when the page was idle. */
  useEffect(() => {
    let raf = 0;
    let stopTimer = 0;
    let frames = 0;
    let startedAt = 0;
    const frame = (t: number) => {
      if (!startedAt) startedAt = t;
      frames += 1;
      raf = requestAnimationFrame(frame);
    };
    const onScroll = () => {
      if (document.visibilityState !== 'visible') return;
      if (!raf) {
        frames = 0;
        startedAt = 0;
        raf = requestAnimationFrame(frame);
      }
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        raf = 0;
        if (startedAt && fpsRef.current) {
          const elapsed = performance.now() - startedAt;
          fpsRef.current.textContent = String(Math.round((frames * 1000) / elapsed));
        }
      }, 650);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const c = (navigator as unknown as { connection?: { rtt?: number } }).connection;
    if (c?.rtt && latRef.current) latRef.current.textContent = `${c.rtt}ms`;
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(stopTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const moveInd = (el?: HTMLElement | null) => {
    if (!el) {
      setInd((v) => ({ ...v, on: false }));
      return;
    }
    setInd({ left: el.offsetLeft, width: el.offsetWidth, on: true });
  };

  const onLinksOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a) moveInd(a as HTMLElement);
  };

  const jump = (sel: string) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navClick = (e: React.MouseEvent, k: NavKey) => {
    e.preventDefault();
    setDrawer(false);
    if (k === 'archive') {
      onArchive();
      return;
    }
    if (k === 'stream' && !isLive) {
      jump('#socials');
      return;
    }
    jump(NAV.find((n) => n.k === k)?.href || '#home');
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      showToast(ar ? 'تم تحديث الحالة' : 'Status refreshed');
    } catch {
      showToast(ar ? 'تعذّر التحديث' : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="abshome" ref={rootRef}>
      <div className="bg-fixed overlay" />
      <div className="zoom">
        <div className="hud" aria-hidden="true">
        <span>FPS <b ref={fpsRef}>--</b></span>
        <i>|</i>
        <span>GPU <b>—</b></span>
        <i>|</i>
        <span>CPU <b>—</b></span>
        <i>|</i>
        <span>LAT <b ref={latRef}>—</b></span>
      </div>

      {/* ===== NAV ===== */}
      {false && <header className="nav">
        <a className="brand" href="#home">
          <span className="bl">
            <img src={logo} alt="iABS" />
            <i className={`on${isLive ? ' live' : ''}`} />
          </span>
          <span className="bt">
            <b>i<em>ABS</em></b>
            <small>{t.hub}</small>
          </span>
        </a>

        <div
          className={`links${ind.on ? ' has' : ''}`}
          ref={linksRef}
          onMouseOver={onLinksOver}
          onMouseLeave={() => moveInd(null)}
        >
          <span className="ind" style={{ left: ind.left, width: ind.width }} />
          {NAV.map((n) => (
            <a key={n.k} href={n.href} onClick={(e) => navClick(e, n.k)}>
              <NavIcon k={n.k} />
              <span>{ar ? n.ar : n.en}</span>
            </a>
          ))}
        </div>

        <div className="tl">
          <span className={`st${isLive ? ' live' : ''}`}>
            <i />
            <b>{status}</b>
          </span>

          <button className="ar" type="button" onClick={(e) => { e.preventDefault(); onArchive(); }}>
            <span className="rg">
              <svg viewBox="0 0 28 28">
                <circle className="t" cx="14" cy="14" r="12" />
                <circle className="p" cx="14" cy="14" r="12" />
              </svg>
              <i>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="5" rx="1.5" />
                  <path d="M5 9v10h14V9" />
                </svg>
              </i>
            </span>
            <span>
              <small>{t.arch}</small>
              <b>60 / 60</b>
            </span>
          </button>

          <button
            className={`nb${refreshing ? ' spin' : ''}`}
            type="button"
            onClick={refresh}
            aria-label={ar ? 'تحديث' : 'Refresh'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
            </svg>
          </button>

          <button className="lang" type="button" onClick={onToggleLang}>
            {ar ? 'EN' : 'AR'}
          </button>

          <button className="nb burger" type="button" onClick={() => setDrawer(true)} aria-label={ar ? 'القائمة' : 'Menu'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
        </div>

        <div className="prog">
          <i />
        </div>
      </header>}

      {/* ===== DRAWER ===== */}
      <div
        className={`drawer${drawer ? ' on' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawer(false);
        }}
      >
        <div className="dh">
          <div className="dbrand">
            <img src={logo} alt="iABS" />
            <span>
              <b>i<em>ABS</em></b>
              <small>{t.hub}</small>
            </span>
          </div>
          <button className="nb x" type="button" onClick={() => setDrawer(false)} aria-label={ar ? 'إغلاق' : 'Close'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="dlab">{t.exp}</div>

        <div className="drl">
          {NAV.map((n, i) => (
            <a
              key={n.k}
              className="di"
              href={n.href}
              onClick={(e) => navClick(e, n.k)}
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className="dn">{`0${i + 1}`}</span>
              <span className="dic"><NavIcon k={n.k} strokeWidth={1.9} /></span>
              <span className="dt">
                <b>{ar ? n.ar : n.en}</b>
                <span>{ar ? n.descAr : n.descEn}</span>
              </span>
              <i className="dgo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d={ar ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
                </svg>
              </i>
            </a>
          ))}
        </div>

        <div className="dfoot">
          <div className="dsoc">
            {socials.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name}>
                {s.icon}
              </a>
            ))}
          </div>
          <div className="dcp">{t.rights}</div>
        </div>
      </div>

      {/* ===== HERO + TICKER ===== */}
      <main className="wrap">
        <section className="hero" id="home">
          <div className="tx">
            <span className="pill rv">
              <i />
              <span>{t.pill}</span>
            </span>

            <div className="who rv" style={{ '--d': '.05s' } as React.CSSProperties}>
              <b>MOHAMMED AL-QAHTANI</b> • <span>{t.who}</span>
            </div>

            <h1 className="title rv" data-t="iABS" style={{ '--d': '.1s' } as React.CSSProperties}>iABS</h1>

            <div className="king rv" style={{ '--d': '.15s' } as React.CSSProperties}>
              KING OF ACCEPTANCE
              <svg viewBox="0 0 360 14" preserveAspectRatio="none">
                <path d="M0 7h300" stroke="#ff2f3a" strokeWidth={2} />
                <path d="M300 7l24-6 20 6-20 6z" fill="#ff2f3a" />
                <path d="M0 7h300" stroke="#ff2f3a" strokeWidth={6} opacity={0.25} />
              </svg>
            </div>

            <p className="desc rv" style={{ '--d': '.2s' } as React.CSSProperties}>
              <b>{ar ? 'محمد القحطاني' : 'Mohammed Al-Qahtani'}</b>{' '}
              {ar
                ? 'يبث هنا يومياً — حياك الله. تابع ملك القبول والاستمرارية، واستمتع بأقوى بثوث الألعاب والسوالف والفعاليات مع مجتمع الأساطير.'
                : 'streams here daily — welcome. Follow the King of Acceptance and enjoy the best gaming streams, chats and events with the Legends community.'}
            </p>

            <div className="tags rv" style={{ '--d': '.25s' } as React.CSSProperties}>
              <span>{t.t1}</span>
              <span>{t.t2}</span>
              <span>{t.t3}</span>
            </div>

            <div className="acts rv" style={{ '--d': '.3s' } as React.CSSProperties}>
              <a className="btn red" href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer">
                <span>{t.watch}</span>
                <span className="bi">
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                </span>
              </a>
              <a className="btn dk" href="https://discord.com/invite/64aggJ9yRA" target="_blank" rel="noopener noreferrer">
                <span>{t.disc}</span>
                <span className="bi"><DiscordIcon /></span>
              </a>
            </div>

            <div className="sts rv" style={{ '--d': '.35s' } as React.CSSProperties}>
              <div className="sc3">
                <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="2" />
                  <rect x="14" y="3" width="7" height="7" rx="2" />
                  <rect x="3" y="14" width="7" height="7" rx="2" />
                  <rect x="14" y="14" width="7" height="7" rx="2" />
                </svg>
                <b><CountNum value={platforms} /></b>
                <span>{t.s1}</span>
              </div>

              <div className="sc3">
                <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <b><CountNum value={visits} group /></b>
                <span>{t.s2}</span>
              </div>

              <div className="sc3">
                <svg className="si" viewBox="0 0 24 24">
                  <path d="M4 3h5v6h2V7h2V5h2V3h5v5h-2v2h-2v4h2v2h2v5h-5v-2h-2v-2h-2v-2H9v6H4z" fill="currentColor" />
                </svg>
                <b><CountNum value={followers / 1000} decimals={1} suffix="K" /></b>
                <span>{t.s3}</span>
              </div>
            </div>
          </div>

          {/* ===== ART ===== */}
          <div className="art rv" style={{ '--d': '.1s' } as React.CSSProperties}>
            <svg viewBox="0 0 640 640" aria-hidden="true">
              <defs>
                <radialGradient id="absh-aura">
                  <stop offset="0" stopColor="#ff2f3a" stopOpacity=".55" />
                  <stop offset=".55" stopColor="#ff2f3a" stopOpacity=".12" />
                  <stop offset="1" stopColor="#ff2f3a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="absh-disc" cx=".5" cy=".35">
                  <stop offset="0" stopColor="#2a1313" />
                  <stop offset="1" stopColor="#070303" />
                </radialGradient>
                <filter id="absh-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="absh-rough">
                  <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="4" />
                  <feDisplacementMap in="SourceGraphic" scale="14" />
                </filter>
                <clipPath id="absh-cc">
                  <circle cx="320" cy="320" r="160" />
                </clipPath>
              </defs>

              <circle className="aura" cx="320" cy="320" r="310" fill="url(#absh-aura)" />

              <g opacity=".22" stroke="#ff2f3a" strokeWidth={1} fill="none">
                {art.hex.map((p, i) => <polygon key={i} points={p} />)}
              </g>

              <g className="ra">
                <circle cx="320" cy="320" r="300" fill="none" stroke="#ff2f3a" strokeWidth={1.5} strokeDasharray="3 9" opacity=".6" />
              </g>

              <g className="rb" stroke="#ece6db" strokeWidth={1.6} opacity=".45">
                {art.ticks.map((l, i) => <line key={i} {...l} />)}
              </g>

              <g className="rc">
                <g fill="none" stroke="#ff2f3a" strokeWidth={7} strokeLinecap="round" filter="url(#absh-glow)">
                  <path d="M320 58a262 262 0 0 1 185 77" />
                  <path d="M582 320a262 262 0 0 1-77 185" />
                  <path d="M320 582a262 262 0 0 1-185-77" />
                  <path d="M58 320a262 262 0 0 1 77-185" />
                </g>
              </g>

              <g className="ra" style={{ animationDuration: '38s' }}>
                {art.orb.map((p, i) => (
                  <polygon key={i} points={p} fill="#ff2f3a" filter="url(#absh-glow)" />
                ))}
              </g>

              <circle cx="320" cy="320" r="182" fill="url(#absh-disc)" stroke="#ff2f3a" strokeWidth={12} filter="url(#absh-rough)" />
              <circle cx="320" cy="320" r="182" fill="none" stroke="#ff2f3a" strokeWidth={3} opacity=".9" />
              <circle cx="320" cy="320" r="168" fill="none" stroke="#ece6db" strokeWidth={1} strokeDasharray="2 6" opacity=".4" />

              <image href={logo} x="159" y="159" width="322" height="322" clipPath="url(#absh-cc)" preserveAspectRatio="xMidYMid slice" />

              <g fill="none" stroke="#ff2f3a" strokeWidth={3} strokeLinecap="square" opacity=".9">
                <path d="M36 76V36h40" />
                <path d="M604 76V36h-40" />
                <path d="M36 564v40h40" />
                <path d="M604 564v40h-40" />
              </g>

              <g fill="#ff7a82">
                {art.sparks.map((s, i) => (
                  <circle
                    key={i}
                    className="sp"
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
                  />
                ))}
              </g>
            </svg>

            <div className={`chip s${isLive ? ' live' : ''}`}>
              <small>{t.state}</small>
              <b><i /> <span>{status}</span></b>
            </div>

            <div className="chip k">
              <small>KICK</small>
              <span>{followersText}</span>
            </div>

            <div className="kb"><KickIcon /></div>
          </div>
        </section>

        <div className="tick">
          <div className="trk">
            {ticker.map((x, i) => <span key={i}>{x}</span>)}
          </div>
        </div>
      </main>

      {/* ===== EXPLORE SECTION — source: abs-explore-snippet (1).html ===== */}
      <section className="abs-explore" id="abs-explore" dir="rtl" aria-labelledby="ae-h">
        <div className="ae-box">
          <div className={`ae-head ae-rv`}>
            <span className="ae-num">00</span>
            <div>
              <span className="ae-tag">EXPLORE</span>
              <h2 className="ae-title" id="ae-h">{t.exp}</h2>
              <p className="ae-sub">{t.expp}</p>
            </div>
            <span className="ae-line"></span>
          </div>
          <div className="ae-grid">
            {NAV.map((n, i) => {
              const icon = NAV_ICONS[n.k];
              const num = i + 1;
              return (
                <a
                  key={n.k}
                  className="ae-tile ae-rv"
                  style={{ '--d': (i * 0.07).toFixed(2) + 's' }}
                  href={n.href}
                  onClick={(e) => navClick(e, n.k as any)}
                >
                  <span className="ae-sw"></span>
                  <span className="ae-gn">{num < 10 ? '0' + num : num}</span>
                  <div className="ae-ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {icon}
                    </svg>
                  </div>
                  <h3 className="ae-name">{ar ? n.ar : n.en}</h3>
                  <p className="ae-desc">{ar ? n.descAr : n.descEn}</p>
                  <div className="ae-go">
                    {ar ? 'افتح' : 'Open'}
                    <span className="ae-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M11 6l-6 6 6 6" />
                      </svg>
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <div className={`toast${toast ? ' on' : ''}`}>{toast}</div>
      </div>
    </div>
  );
};

export default HomeHero;
