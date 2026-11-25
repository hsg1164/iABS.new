import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './SupportSection.css';
import { Language } from '../types';
import {
  SupportBoards,
  SupportPlatform,
  TipInterval,
  getSupportBoards,
} from '../utils/supportersApi';

/* ============================================================
   ABS Support v5 — exact port of «abs-support-v2 (5).html»
   Data: live Streamlabs + Creators leaderboards (no demo rows).
   ============================================================ */

type Source = 'all' | SupportPlatform;

interface RankItem {
  n: string;
  w: number;
  p: SupportPlatform | null;
  r: number;
  pin?: boolean;
}

interface Cluster {
  k: string;
  n: string;
  w: number;
  ps: SupportPlatform[];
  best: number;
  pin: boolean;
}

interface Person {
  name: string;
  platforms: SupportPlatform[];
}

const PLATFORM: Record<
  SupportPlatform,
  { name: string; key: string; desc: string; descEn: string; color: string; url: string }
> = {
  sl: {
    name: 'Streamlabs',
    key: 'STREAMLABS',
    desc: 'تنبيهات فورية على البث',
    descEn: 'Instant alerts on stream',
    color: '#ff3b45',
    url: 'https://streamlabs.com/iabs/tip',
  },
  cr: {
    name: 'Creators',
    key: 'CREATORS',
    desc: 'صفحة الدعم الرسمية الآمنة',
    descEn: 'Official secure support page',
    color: '#ff8a3d',
    url: 'https://tip.dokan.sa/abs',
  },
};

const PERIODS: { id: TipInterval; ar: string; en: string }[] = [
  { id: 'week', ar: 'آخر أسبوع', en: 'This week' },
  { id: 'month', ar: 'آخر شهر', en: 'This month' },
  { id: 'all', ar: 'كل الوقت', en: 'All time' },
];

const PERIOD_TITLE: Record<TipInterval, { ar: string; en: string }> = {
  week: { ar: 'نجوم هذا الأسبوع', en: 'Stars of this week' },
  month: { ar: 'أبطال هذا الشهر', en: 'Heroes of this month' },
  all: { ar: 'الأساطير على الإطلاق', en: 'Legends of all time' },
};

/* v5 ranking settings */
const PINNED = ['Xx'];
const WEIGHT: Record<SupportPlatform, number> = { sl: 1, cr: 1 };
const RK = 2;

/* v5 medal colour pairs (face | ribbon) */
const MEDAL = ['', '#d9d9de|#8d8d96', '#cd925f|#7d5a40'];
const medalPair = (i: number) => MEDAL[i] || MEDAL[1];

const CROWN = 'M3 18h18l1.5-11-5.5 4.5L12 4 7 11.5 1.5 7 3 18zm1 2h16v2H4z';

const ICO: Record<string, React.ReactNode> = {
  arr: (
    <path
      d="M19 12H5M11 6l-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  cpy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  crown: <path d={CROWN} fill="currentColor" />,
  crown2: (
    <>
      <path
        d="M3.5 8.5 8 12l4-7 4 7 4.5-3.5-1.8 8.5H5.3z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <rect x="5" y="19.3" width="14" height="2" rx="1" fill="currentColor" />
    </>
  ),
  stack: (
    <path
      d="M12 3 3 8l9 5 9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth={2.6} />
      <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  close: (
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" />
  ),
  refresh: (
    <path
      d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  spark: (
    <path
      d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"
      fill="currentColor"
    />
  ),
};

const Ico: React.FC<{ k: string; className?: string }> = ({ k, className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    {ICO[k]}
  </svg>
);

const initial = (name: string): string => (Array.from(name)[0] || '?').toUpperCase();

const Medal: React.FC<{ pair: string }> = ({ pair }) => {
  const [face = '#d9d9de', ribbon = '#8d8d96'] = pair.split('|');
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 3h9l4 13h-9z" fill={ribbon} />
      <path d="M35 3h-9l-4 13h9z" fill={ribbon} opacity=".7" />
      <circle cx="24" cy="30" r="14.5" fill={face} />
      <circle cx="24" cy="30" r="14.5" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
      <circle cx="24" cy="30" r="10.5" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="1.5" />
      <path d="m24 23 2.3 4.7 5.2.8-3.8 3.6.9 5.1L24 34.8l-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" fill="rgba(0,0,0,.45)" />
    </svg>
  );
};

/* Official-looking marks from the source design (red gradient). */
const Logos: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <linearGradient id="absup-gr1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff8a8f" />
        <stop offset="1" stopColor="#d1121c" />
      </linearGradient>
      <linearGradient id="absup-gr2" gradientUnits="userSpaceOnUse" x1="-60" y1="-90" x2="60" y2="90">
        <stop offset="0" stopColor="#ffb06a" />
        <stop offset=".5" stopColor="#ff5a3a" />
        <stop offset="1" stopColor="#d1121c" />
      </linearGradient>
      <symbol id="absup-sl" viewBox="0 0 100 100">
        <path d="M16 52C16 36 28 24 44 22" fill="none" stroke="url(#absup-gr1)" strokeWidth="8" strokeLinecap="round" />
        <rect x="30" y="34" width="56" height="54" rx="17" fill="url(#absup-gr1)" />
        <rect x="50" y="54" width="8" height="20" rx="4" fill="#0a0505" />
        <rect x="66" y="54" width="8" height="20" rx="4" fill="#0a0505" />
      </symbol>
      <symbol id="absup-cr" viewBox="-100 -100 200 200">
        <g fill="url(#absup-gr2)">
          {[65, 32, 0, -30, -60, -90, -120, -150, -180, -212, -245].map((deg) => (
            <rect key={deg} x="-10.5" y="-88" width="21" height="48" rx="4.5" transform={`rotate(${deg})`} />
          ))}
          <circle r="41" fill="none" stroke="url(#absup-gr2)" strokeWidth="15" strokeDasharray="229 28.6" transform="rotate(20)" />
        </g>
      </symbol>
    </defs>
  </svg>
);

/* Every logo uses the same 0 0 100 100 frame — the referenced <symbol>
   carries its own viewBox, which is what the source design relies on.
   Using the symbol's viewBox on the outer <svg> as well would clip it. */
const Logo: React.FC<{ p: SupportPlatform; className?: string }> = ({ p, className }) => (
  <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
    <use href={`#absup-${p}`} />
  </svg>
);

const Chips: React.FC<{ ps?: SupportPlatform[] }> = ({ ps }) =>
  ps && ps.length > 0 ? (
    <span className="pcs">
      {ps.map((p) => (
        <Logo key={p} p={p} />
      ))}
    </span>
  ) : null;

/* ---------- v5 fuzzy merge ---------- */
const norm = (s: string): string =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

const skey = (s: string): string => {
  const k = norm(s);
  const t = k.replace(/(.)\1+/g, '$1');
  const u = t.replace(/\d+$/, '');
  return u.length >= 3 ? u : t;
};

const lev = (a: string, b: string): number => {
  const p: number[] = [];
  for (let j = 0; j <= b.length; j += 1) p[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let d = p[0];
    p[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const t = p[j];
      p[j] = Math.min(p[j] + 1, p[j - 1] + 1, d + (a[i - 1] === b[j - 1] ? 0 : 1));
      d = t;
    }
  }
  return p[b.length];
};

const same = (a: string, b: string): boolean => {
  if (a === b) return true;
  return a.length >= 6 && b.length >= 6 && Math.abs(a.length - b.length) <= 1 && lev(a, b) <= 1;
};

const merge = (items: RankItem[]): Cluster[] => {
  const clusters: Cluster[] = [];
  items.forEach((it) => {
    const k = skey(it.n);
    let c = clusters.find((cl) => same(cl.k, k));
    if (!c) {
      c = { k, n: it.n, w: 0, ps: [], best: it.r, pin: false };
      clusters.push(c);
    }
    c.w += it.w;
    if (it.p && !c.ps.includes(it.p)) c.ps.push(it.p);
    if (it.pin) {
      c.pin = true;
      c.n = it.n;
    } else if (it.r < c.best) {
      c.best = it.r;
      if (!c.pin) c.n = it.n;
    }
  });
  return clusters;
};

const namesOf = (boards: SupportBoards | null, p: SupportPlatform, per: TipInterval): string[] =>
  (boards?.[p]?.[per]?.entries ?? []).map((e) => e.name).filter(Boolean);

/* Combined ranking — exactly the v5 formula. */
const combinedFor = (boards: SupportBoards | null, per: TipInterval): Person[] => {
  const items: RankItem[] = [];
  (['sl', 'cr'] as SupportPlatform[]).forEach((p) => {
    namesOf(boards, p, per).forEach((n, i) => {
      items.push({ n, w: (WEIGHT[p] || 1) / (i + RK), p, r: i });
    });
  });
  PINNED.forEach((n, i) => {
    if (String(n).trim()) items.push({ n, w: 1e6 - i * 1e3, p: null, r: -1, pin: true });
  });
  return merge(items)
    .sort((a, b) => b.w - a.w || b.ps.length - a.ps.length || a.best - b.best)
    .slice(0, 10)
    .map((c) => ({ name: c.n, platforms: c.ps }));
};

/* One-platform ranking — exactly the v5 platNames formula. */
const platformFor = (boards: SupportBoards | null, p: SupportPlatform, per: TipInterval): Person[] => {
  const items: RankItem[] = namesOf(boards, p, per).map((n, i) => ({ n, w: 1 / (i + 1), p, r: i }));
  return merge(items)
    .sort((a, b) => b.w - a.w || a.best - b.best)
    .slice(0, 10)
    .map((c) => ({ name: c.n, platforms: [p] }));
};

/* ---------- segmented control with sliding indicator ---------- */
const Seg: React.FC<{
  value: TipInterval;
  ar: boolean;
  onChange: (v: TipInterval) => void;
}> = ({ value, ar, onChange }) => {
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
    const t = window.setTimeout(place, 400);
    if (document.fonts?.ready) document.fonts.ready.then(place).catch(() => {});
    return () => {
      window.removeEventListener('resize', place);
      window.clearTimeout(t);
    };
  }, [place, value]);

  return (
    <div className="seg" ref={ref}>
      <span className="ind" />
      {PERIODS.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)}>
          {ar ? p.ar : p.en}
        </button>
      ))}
    </div>
  );
};

const RowLead: React.FC<{ name: string; index: number }> = ({ name, index }) => {
  if (index === 0) {
    return (
      <div className="ri cw">
        <Ico k="crown2" />
      </div>
    );
  }
  if (index < 3) {
    return (
      <div className="ri">
        <Medal pair={medalPair(index)} />
      </div>
    );
  }
  return (
    <div className="ri dm">
      <b>{initial(name)}</b>
    </div>
  );
};

const SupportSection: React.FC<{ lang: Language; no?: string }> = ({ lang, no = '03' }) => {
  const ar = lang !== 'en';

  const [period, setPeriod] = useState<TipInterval>('week');
  const [source, setSource] = useState<Source>('all');
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const [boards, setBoards] = useState<SupportBoards | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const [revealed, setRevealed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef(0);

  const rv = revealed ? 'rv in' : 'rv';
  const nextNo = String(Number(no) + 1).padStart(2, '0');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2000);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    getSupportBoards(false)
      .then((b) => {
        if (!dead) setBoards(b);
      })
      .catch(() => {})
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const b = await getSupportBoards(true);
      setBoards(b);
      showToast(ar ? 'تم تحديث القوائم' : 'Leaderboards updated');
    } catch {
      showToast(ar ? 'تعذّر التحديث' : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [ar, refreshing, showToast]);

  const copyLink = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, p: SupportPlatform) => {
      e.preventDefault();
      e.stopPropagation();
      const url = PLATFORM[p].url;
      const done = () => showToast(ar ? `تم نسخ رابط ${PLATFORM[p].name}` : `${PLATFORM[p].name} link copied`);
      const fail = () => showToast(ar ? 'تعذّر النسخ' : 'Copy failed');

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          done();
          return;
        }
        throw new Error('clipboard unavailable');
      } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.cssText = 'position:fixed;opacity:0;top:0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? done() : fail();
        } catch {
          fail();
        }
      }
    },
    [ar, showToast]
  );

  const list = useMemo<Person[]>(() => {
    if (!boards) return [];
    return source === 'all' ? combinedFor(boards, period) : platformFor(boards, source, period);
  }, [boards, period, source]);

  const status = useMemo<'loading' | 'live' | 'cache' | 'off'>(() => {
    if (loading && !boards) return 'loading';
    if (source === 'all') {
      const sl = boards?.sl?.[period];
      const cr = boards?.cr?.[period];
      const has = !!((sl?.entries.length || 0) + (cr?.entries.length || 0));
      if (!has) return 'off';
      const live = !!(sl?.live && sl.entries.length) || !!(cr?.live && cr.entries.length);
      return live ? 'live' : 'cache';
    }
    const b = boards?.[source]?.[period];
    if (!b?.entries.length) return 'off';
    return b.live ? 'live' : 'cache';
  }, [boards, loading, period, source]);

  const q = query.trim().toLowerCase();
  const hasQuery = !!query;
  const open = more || !!q;

  const resultCount = useMemo(() => {
    if (!q) return 0;
    const hit = new Set<string>();
    list.forEach((p) => {
      const k = p.name.toLowerCase();
      if (k.includes(q)) hit.add(k);
    });
    return hit.size;
  }, [list, q]);

  const rest = list.slice(3);
  const hidden = Math.max(0, rest.length - 4);
  const pc = source === 'all' ? '#ff2f3a' : PLATFORM[source].color;
  const periodTitle = PERIOD_TITLE[period][ar ? 'ar' : 'en'];
  const subtitle = source === 'all' ? 'Streamlabs + Creators' : PLATFORM[source].name;

  const statusLabel =
    status === 'live'
      ? ar
        ? 'مباشر'
        : 'Live'
      : status === 'cache'
        ? ar
          ? 'محفوظ'
          : 'Cached'
        : status === 'loading'
          ? ar
            ? 'جارِ الجلب…'
            : 'Loading…'
          : ar
            ? 'غير متاح'
            : 'Unavailable';

  const countText = !q
    ? ''
    : resultCount
      ? ar
        ? `${resultCount} ${resultCount === 1 ? 'نتيجة' : 'نتائج'}`
        : `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`
      : ar
        ? 'لا توجد نتائج'
        : 'No results';

  const isDim = (name: string) => !!q && !name.toLowerCase().includes(q);

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const toggleMore = () => {
    if (open) {
      setMore(false);
      if (query) setQuery('');
    } else {
      setMore(true);
    }
  };

  const pills: { id: Source; label: string; bp: string; icon: React.ReactNode }[] = [
    { id: 'all', label: ar ? 'الكل' : 'All', bp: '#ff2f3a', icon: <Ico k="stack" /> },
    { id: 'cr', label: 'Creators', bp: PLATFORM.cr.color, icon: <Logo p="cr" /> },
    { id: 'sl', label: 'Streamlabs', bp: PLATFORM.sl.color, icon: <Logo p="sl" /> },
  ];

  return (
    <div className="absup">
      <Logos />

      {/* ===== SUPPORT ===== */}
      <div className={`sh ${rv}`}>
        <span className="num" dir="ltr">{no}</span>
        <div className="tx">
          <span className="tag">SUPPORT</span>
          <h2>{ar ? 'ادعم iABS' : 'Support iABS'}</h2>
          <p>{ar ? 'ادعم البث عبر Streamlabs أو Creators.' : 'Support the stream via Streamlabs or Creators.'}</p>
        </div>
        <span className="ln" />
      </div>

      <div className="arena two">
        {(['sl', 'cr'] as SupportPlatform[]).map((p, i) => {
          const f = PLATFORM[p];
          return (
            <a
              key={p}
              className={`pl sup cut ${rv}`}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ '--pc': f.color, '--d': `${i * 0.1}s` } as React.CSSProperties}
              aria-label={`${ar ? 'ادعم عبر' : 'Support via'} ${f.name}`}
            >
              <span className="sw" />
              <Logo p={p} className="ghost" />
              <div className="ic"><Logo p={p} /></div>
              <div className="bd">
                <div className="k">{f.key}</div>
                <div className="h">{f.name}</div>
                <div className="d">{ar ? f.desc : f.descEn}</div>
              </div>
              <div className="go"><Ico k="arr" /></div>
              <button
                className="cp"
                type="button"
                onClick={(e) => copyLink(e, p)}
                aria-label={ar ? `نسخ رابط ${f.name}` : `Copy ${f.name} link`}
              >
                <Ico k="cpy" />
              </button>
            </a>
          );
        })}
      </div>

      {/* ===== TOP SUPPORTERS ===== */}
      <div className={`sh ${rv}`} style={{ marginTop: 34 }}>
        <span className="num" dir="ltr">{nextNo}</span>
        <div className="tx">
          <span className="tag">TOP SUPPORTERS</span>
          <h2>{ar ? 'أكثر الداعمين' : 'Top Supporters'}</h2>
          <p>
            {ar
              ? 'الأسماء فقط، حسب الأسبوع والشهر وكل الوقت، من المنصتين.'
              : 'Names only, by week, month and all time — from both platforms.'}
          </p>
        </div>
        <span className="ln" />
      </div>

      <div className={`tools ${rv}`}>
        <Seg value={period} ar={ar} onChange={setPeriod} />

        <label className={`search${hasQuery ? ' has' : ''}${q && !resultCount ? ' none' : ''}`}>
          <span className="si"><Ico k="search" /></span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                setQuery('');
              }
            }}
            placeholder={ar ? 'ابحث باسم الداعم…' : 'Search supporter name…'}
            autoComplete="off"
            spellCheck={false}
            aria-label={ar ? 'ابحث باسم الداعم' : 'Search supporter name'}
          />
          <span className="sc" aria-live="polite">{countText}</span>
          <button type="button" className="sx" onClick={clearSearch} aria-label={ar ? 'مسح البحث' : 'Clear search'}>
            <Ico k="close" />
          </button>
          <kbd>/</kbd>
        </label>

        <button
          className="sbtn rf"
          type="button"
          onClick={refresh}
          disabled={refreshing}
          title={ar ? 'تحديث' : 'Refresh'}
          aria-label={ar ? 'تحديث القوائم' : 'Refresh leaderboards'}
        >
          <Ico k="refresh" className={refreshing ? 'sp' : ''} />
        </button>
      </div>

      {/* ===== COMBINED ===== */}
      <section
        className={`hc cut all ${rv}${open ? ' open' : ''}`}
        style={{ '--pc': pc } as React.CSSProperties}
      >
        <div className="hh">
          <div className="ic">
            <svg viewBox="0 0 24 24" style={{ color: pc, width: 30, height: 30 }} aria-hidden="true">
              {ICO.crown2}
            </svg>
          </div>
          <div>
            <h3>{ar ? 'الأكثر دعماً' : 'Most Supported'}</h3>
            <p>{periodTitle} · {subtitle}</p>
          </div>
          {status === 'live' ? (
            <span className="stt live"><i />{statusLabel}</span>
          ) : (
            <span className="stt demo"><Ico k="spark" />{statusLabel}</span>
          )}
        </div>

        <div className="pf">
          {pills.map((p) => (
            <button
              key={p.id}
              type="button"
              data-src={p.id}
              aria-pressed={source === p.id}
              style={{ '--bp': p.bp } as React.CSSProperties}
              onClick={() => setSource(p.id)}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {list.length > 0 ? (
          <>
            <div className="ros">
              {list.slice(0, 3).map((d, i) => {
                const first = i === 0;
                return (
                  <div
                    key={`${period}-${source}-f-${i}-${d.name}`}
                    className={`fc cut${first ? ' r1' : ' wide'}${isDim(d.name) ? ' dim' : ''}`}
                    data-u={d.name}
                    style={{ '--pc': pc } as React.CSSProperties}
                  >
                    <svg className="gh" viewBox="0 0 24 24" aria-hidden="true">
                      {first ? ICO.crown : <circle cx="12" cy="14" r="8" fill="currentColor" />}
                    </svg>
                    <div className="tp">
                      {first ? (
                        <>
                          <svg className="crown" viewBox="0 0 24 24" aria-hidden="true">{ICO.crown2}</svg>
                          <span className="kg">{ar ? 'المتصدر' : 'THE LEADER'}</span>
                          <div className="av">{initial(d.name)}</div>
                        </>
                      ) : (
                        <div className="ri"><Medal pair={medalPair(i)} /></div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="nm" dir="auto">{d.name}</div>
                        <Chips ps={d.platforms} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {rest.length > 0 && (
              <div className="lst cut">
                {rest.map((d, i) => {
                  const overall = i + 3;
                  return (
                    <div
                      key={`${period}-${source}-r-${i}-${d.name}`}
                      className={`nr${overall < 3 ? ' top' : ''}${overall === 0 ? ' t1' : ''}${i >= 4 ? ' xr' : ''}${isDim(d.name) ? ' dim' : ''}`}
                      data-u={d.name}
                      style={{ '--d': `${overall * 0.05}s` } as React.CSSProperties}
                    >
                      <RowLead name={d.name} index={overall} />
                      <div className="nm" dir="auto">{d.name}</div>
                      <Chips ps={d.platforms} />
                    </div>
                  );
                })}
              </div>
            )}

            {rest.length > 4 && (
              <button className="mr" type="button" onClick={toggleMore}>
                {open
                  ? ar
                    ? 'عرض أقل'
                    : 'Show less'
                  : ar
                    ? `عرض المزيد (${hidden})`
                    : `Show more (${hidden})`}
              </button>
            )}
          </>
        ) : (
          <div className="empty">
            {loading && !boards
              ? ar
                ? 'جارِ الجلب…'
                : 'Loading…'
              : ar
                ? 'لا توجد أسماء حالياً.'
                : 'No names right now.'}
          </div>
        )}
      </section>

      <div className={`toast${toast ? ' on' : ''}`}>{toast}</div>
    </div>
  );
};

export default SupportSection;
