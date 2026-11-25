import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import './ModeratorsSection.css';

// ============================================================
//  MODERATORS — قسم المشرفين (بيانات حية من X via FixTweet)
//  20 مشرف: 1 قائد BOSS (inormalq) + 19 مشرف GRID
//  الطبقات: بروكسي /api/kick → مباشر → fallback ثابت
//  الكاش: localStorage 30 دقيقة + تحديث صامت كل 10 دقائق
// ============================================================

interface RosterEntry {
  kick: string;
  x: string;
  boss?: boolean;
}

// 20 moderators — Kick name + X handle (live data via FixTweet)
// القائد أولاً دائماً: ROSTER[0] هو الـ BOSS
const ROSTER: RosterEntry[] = [
  { kick: 'inormalq', x: 'inormalq', boss: true },
  { kick: '_iAli5', x: '_iAli5' },
  { kick: 'iAbo3tab', x: 'iAbo3tab' },
  { kick: 'SHADDDOH', x: 'SHADDDOH' },
  { kick: 'Shanzleezayh', x: 'Shanzleezayh' },
  { kick: 'rwubii', x: 'rwubii' },
  { kick: 'IIYZL1', x: 'IIYZL1' },
  { kick: 'Fotaamii', x: 'Fotaamii' },
  { kick: '4sshd', x: '4sshd' },
  { kick: 'mohmd505_', x: 'mohmd505_' },
  { kick: 'jj4naa', x: 'jj4naa' },
  { kick: 'Moh_HSG', x: 'Moh_HSG' },
  { kick: 'awash70_', x: 'awash70_' },
  { kick: 'wjdann_38', x: 'wjdann_38' },
  { kick: 'sipdai', x: 'sipdai' },
  { kick: 'unnFamiliarr', x: 'unnFamiliarr' },
  { kick: '_A7MEDO_', x: '_A7MEDO_' },
  { kick: 'iluxl3', x: 'iluxl3' },
];

interface ModProfile {
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  bio: string;
  followers: number | null;
  tweets: number | null;
  live: boolean;
}

const CACHE_KEY = 'iabs_mods_cache_v3';
const LEGACY_CACHE_KEY = 'iabs_mods_cache_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

/**
 * يضبط مقاس صورة البانر من CDN.
 * المقاسات المتاحة فعلياً عند pbs.twimg.com: 1500x500 (59KB) · 600x200 (15KB) · 300x100 (6KB)
 * Anything else يرجع 404 — لذلك نحصرها هنا ومعها fallback عند فشل التحميل.
 */
const BANNER_SIZES = ['1500x500', '600x200', '300x100'] as const;

const stripBannerSize = (url: string): string => url.split('?')[0].replace(/\/$/, '').replace(/\/(1500x500|600x200|300x100|normal)$/, '');

const bannerAt = (url: string, size: typeof BANNER_SIZES[number]): string => {
  if (!url) return '';
  return `${stripBannerSize(url)}/${size}`;
};

const imageVariants = (url: string, kind: 'avatar' | 'banner'): string[] => {
  if (!url) return [];
  if (kind === 'banner') return [bannerAt(url, '1500x500'), bannerAt(url, '600x200'), bannerAt(url, '300x100')].filter(Boolean);
  const base = url.replace(/_(normal|200x200|400x400)\./, '.');
  return [url, url.replace('_200x200.', '_400x400.'), url.replace('_200x200.', '_normal.'), base].filter(Boolean);
};

const RemoteImage: React.FC<{ src: string; kind: 'avatar' | 'banner'; alt?: string; className?: string; fallback: React.ReactNode }> = ({ src, kind, alt = '', className, fallback }) => {
  const sources = imageVariants(src, kind);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [src]);
  if (!sources[index]) return <>{fallback}</>;
  return <img className={className} src={sources[index]} alt={alt} loading="lazy" onError={() => setIndex((i) => i + 1)} />;
};

const compact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Layer 1: our server proxy (no CORS issues) → Layer 2: direct FixTweet → Layer 3: static fallback
async function fetchMod(handle: string): Promise<ModProfile | null> {
  const target = `https://api.fxtwitter.com/${handle}`;
  let user: any = null;
  try {
    const via = await fetchJson('/api/kick?endpoint=' + encodeURIComponent(target));
    user = via?.user || null;
  } catch {
    /* fall through */
  }
  if (!user) {
    try {
      const direct = await fetchJson(target);
      user = direct?.user || null;
    } catch {
      /* fall through */
    }
  }
  if (!user) return null;

  // ===== مقاسات صور معقولة =====
  // البانر يُعرض بحجم ~96px ارتفاع فقط — تحميل 1500x500 كان يستهلك مئات
  // الكيلوبايت لكل مشرف (20 مشرف) ويسبّب تعليق الموقع. الآن 500x150.
  const avatarRaw: string = user.avatar_url || '';
  const bannerRaw: string = user.banner_url || '';

  return {
    name: user.name || handle,
    handle: user.screen_name || handle,
    // الصورة تُعرض بحجم 56px (أو 96px للبوس) — 200x200 أكثر من كافٍ
    avatar: avatarRaw ? avatarRaw.replace('_normal.', '_200x200.') : '',
    banner: bannerAt(bannerRaw, '600x200'),
    bio: user.description || '',
    followers: typeof user.followers === 'number' ? user.followers : null,
    tweets: typeof user.tweets === 'number' ? user.tweets : null,
    live: true,
  };
}

function readCache(): { at: number; data: Record<string, ModProfile> } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- Icons ----------
const XIconSmall: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const CrownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-7 h-7'} viewBox="0 0 24 24" fill="none">
    <path fill="#FFD76A" d="M2.5 8.5 6.5 12l5.5-7 5.5 7 4-3.5L20 18H4L2.5 8.5z" />
    <rect x="4" y="18.6" width="16" height="2.2" rx="1.1" fill="#B45309" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

// ---------- Section ----------
const ModeratorsSection: React.FC<{ lang: Language }> = ({ lang }) => {
  const [profiles, setProfiles] = useState<Record<string, ModProfile>>(() => readCache()?.data || {});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'def' | 'fol' | 'az'>('def');
  const pageRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  const t = {
    mod: lang === 'ar' ? 'مشرف' : 'MOD',
    boss: lang === 'ar' ? 'القائد' : 'BOSS',
    followers: lang === 'ar' ? 'متابع' : 'Followers',
    posts: lang === 'ar' ? 'منشور' : 'Posts',
    follow: lang === 'ar' ? 'تابع' : 'Follow',
  };

  useEffect(() => {
    let cancelled = false;

    const load = async (useCacheFirst = true) => {
      const cached = readCache();
      const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
      if (useCacheFirst && fresh) {
        setProfiles(cached.data);
        setLoading(false);
      }
      // دفعات 3 متوازية + عرض تدريجي
      for (let i = 0; i < ROSTER.length; i += 3) {
        const batch = await Promise.all(
          ROSTER.slice(i, i + 3).map(async (m) => {
            try {
              const p = await fetchMod(m.x);
              return { x: m.x.toLowerCase(), p };
            } catch {
              return { x: m.x.toLowerCase(), p: null };
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, ModProfile> = {};
        batch.forEach(({ x, p }) => {
          if (p) next[x] = p;
        });
        if (Object.keys(next).length > 0) {
          setProfiles((prev) => {
            const merged = { ...prev, ...next };
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: merged }));
            } catch {}
            return merged;
          });
        }
      }
      if (!cancelled) setLoading(false);
    };

    load(true);
    // تحديث صامت كل 10 دقائق، ويتوقف كلياً والتبويب مخفي (20 طلب شبكة لكل دورة)
    let timer: ReturnType<typeof setInterval> | null = null;
    const startRefresh = () => { if (!timer) timer = setInterval(() => load(false), REFRESH_MS); };
    const stopRefresh = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.visibilityState === 'visible') startRefresh();
      else stopRefresh();
    };
    startRefresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      stopRefresh();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    const node = pageRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setEntered(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEntered(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateParallax = () => {
      const node = pageRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const range = window.innerHeight + rect.height;
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / Math.max(1, range)));
      const shift = (0.5 - progress) * 70;
      const tilt = (0.5 - progress) * 0.8;
      node.style.setProperty('--mods-parallax', `${shift.toFixed(2)}px`);
      node.style.setProperty('--mods-tilt', `${tilt.toFixed(2)}deg`);
      node.style.setProperty('--mods-glow', `${(0.35 + progress * 0.65).toFixed(2)}`);
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; updateParallax(); });
    };
    updateParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Fallback ذكي: بيانات Kick الثابتة إن غابت X
  const get = (x: string): ModProfile => {
    const p = profiles[x.toLowerCase()];
    if (p) return p;
    const r = ROSTER.find((m) => m.x.toLowerCase() === x.toLowerCase())!;
    return {
      name: r.kick,
      handle: x,
      avatar: '',
      banner: '',
      bio: '',
      followers: null,
      tweets: null,
      live: false,
    };
  };

  const boss = ROSTER[0];
  const rest = ROSTER.slice(1).filter(m => {
    const p = get(m.x);
    const q = query.trim().toLowerCase();
    return !q || `${p.name} ${p.handle} ${m.kick} ${p.bio}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sort === 'az') return get(a.x).name.localeCompare(get(b.x).name);
    if (sort === 'fol') return (get(b.x).followers || 0) - (get(a.x).followers || 0);
    return 0;
  });
  const bossP = get(boss.x);

  const avatar = (p: ModProfile, m: RosterEntry, bossMode = false) => (
    <div className={`mods-avatar${bossMode ? ' boss' : ''}`}>
      <span>{m.kick.charAt(0).toUpperCase()}</span>
      {p.avatar && <RemoteImage src={p.avatar} kind="avatar" alt={p.name} fallback={null} />}
      {bossMode && <CrownIcon className="mods-crown" />}
      {p.live && <i />}
    </div>
  );

  return (
    <div ref={pageRef} className={`mods-page${entered ? ' is-visible' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mods-wrap">
        <header className="mods-heading"><span className="mods-number">04</span><div><b className="mods-tag">MODERATORS</b><h2>{lang === 'ar' ? 'المشرفون' : 'Moderators'}</h2><p>{lang === 'ar' ? 'فريق iABS الذي يحمي المجتمع ويدير الدردشة.' : 'The iABS team protecting the community and leading the chat.'}</p></div><i /></header>
        <section className="mods-feature">
          <div className="mods-banner">{bossP.banner ? <RemoteImage src={bossP.banner} kind="banner" alt="" fallback={<div className="mods-art" />} /> : <div className="mods-art" />}<a href={`https://x.com/${boss.x}`} target="_blank" rel="noopener noreferrer"><XIconSmall /></a></div>
          <div className="mods-feature-body">{avatar(bossP, boss, true)}<div className="mods-main-info"><h3>{bossP.name}</h3><p dir="ltr"><span>@{bossP.handle}</span> · KICK: {boss.kick}</p><p className="mods-bio">{bossP.bio || (lang === 'ar' ? 'المشرف الرئيسي لمجتمع iABS.' : 'Lead moderator of the iABS community.')}</p><a className="mods-follow" href={`https://x.com/${boss.x}`} target="_blank" rel="noopener noreferrer"><XIconSmall /> {t.follow} @{boss.x}</a></div><div className="mods-stats"><b>{compact(bossP.followers)}<small>{t.followers}</small></b><b>{compact(bossP.tweets)}<small>{t.posts}</small></b></div></div>
        </section>
        <div className="mods-tools"><label><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={lang === 'ar' ? 'ابحث باسم المشرف أو اليوزر' : 'Search by moderator or username'} /></label><div className="mods-sort">{(['def','fol','az'] as const).map(k => <button key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>{k === 'def' ? (lang === 'ar' ? 'الافتراضي' : 'Default') : k === 'fol' ? (lang === 'ar' ? 'الأكثر متابعة' : 'Most followed') : 'A–Z'}</button>)}</div><strong>{rest.length} {lang === 'ar' ? 'مشرف' : 'mods'}</strong></div>
        <section className="mods-grid">{rest.map((m, i) => { const p = get(m.x); return <article className="mod-card" key={m.x} style={{'--delay': `${Math.min(i, 12) * 0.05}s`} as React.CSSProperties}><div className="mod-card-banner">{p.banner ? <RemoteImage src={p.banner} kind="banner" alt="" fallback={<div className="mods-art" />} /> : <div className="mods-art" />}<span>{t.mod}</span><a href={`https://x.com/${m.x}`} target="_blank" rel="noopener noreferrer"><XIconSmall /></a></div><div className="mod-card-body">{avatar(p, m)}<div className="mod-card-info"><h4>{p.name}</h4><p dir="ltr">@{p.handle}</p></div><p className="mod-card-bio">{p.bio || '—'}</p><div className="mod-card-foot"><b dir="ltr">{compact(p.followers)} <small>{t.followers}</small></b><a href={`https://x.com/${m.x}`} target="_blank" rel="noopener noreferrer"><XIconSmall /> {t.follow}</a></div></div></article>; })}</section>
      </div>
    </div>
  );
};

export default ModeratorsSection;
