// Live social counters — 3-layer architecture per platform:
//   1) /api/social (server-side: Vercel Edge in prod, vite middleware in dev)
//   2) Direct client fetch (CORS-open sources only)
//   3) Verified static fallback (last confirmed live numbers, 2026-11-20)
//
// Verified live on 2026-11-20:
//   TikTok @iabsq .... 80,143 (TokCount) | YouTube UC... 129,430 (Mixerno)
//   X @iABSq ......... 77,835 (FixTweet) | Instagram @absq 27K (og:description)
//   WhatsApp channel . 22K (channel page og:description)

export interface SocialMediaStats {
  instagram?: number;
  tiktok?: number;
  twitter?: number;
  youtube?: number;
  whatsapp?: number;
}

export const FALLBACK = {
  instagram: 27000, // og:description via Googlebot UA (verified 2026-11-20)
  tiktok: 80143, // TokCount embedded stats (verified 2026-11-20)
  twitter: 77835, // FixTweet (verified 2026-11-20)
  youtube: 129430, // Mixerno (verified 2026-11-20)
  whatsapp: 22000, // WhatsApp channel page (22K, verified 2026-11-20) — live via /api/social
};

const CACHE_KEY = 'iabs_social_cache_v1';
export const SOCIAL_TTL_MS = 5 * 60 * 1000;

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Layer 1 — our server API (works in dev + prod, no CORS issues). */
async function viaServerApi(platform: 'tiktok' | 'instagram' | 'twitter' | 'youtube' | 'whatsapp'): Promise<number | null> {
  try {
    const j = await fetchJson(`/api/social?platform=${platform}`);
    return typeof j?.count === 'number' && j.count > 0 ? j.count : null;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function getInstagramFollowers(username = 'absq'): Promise<number> {
  void username;
  return (await viaServerApi('instagram')) ?? FALLBACK.instagram;
}

export async function getTikTokFollowers(username = 'iabsq'): Promise<number> {
  void username;
  return (await viaServerApi('tiktok')) ?? FALLBACK.tiktok;
}

export async function getTwitterFollowers(username = 'iABSq'): Promise<number> {
  const via = await viaServerApi('twitter');
  if (via) return via;
  // Layer 2 — FixTweet API (usually CORS-open)
  try {
    const d = await fetchJson(`https://api.fxtwitter.com/${username}`);
    const n = num(d?.user?.followers);
    if (n) return n;
  } catch {}
  return FALLBACK.twitter;
}

export async function getYouTubeSubscribers(channelId = 'UCdIM7MB-8G-FgE7ld3XAQ8w'): Promise<number> {
  const via = await viaServerApi('youtube');
  if (via) return via;
  // Layer 2a — LemnosLife operational API (no key, CORS-open, mirrors YouTube statistics)
  try {
    const d = await fetchJson(`https://yt.lemnoslife.com/noKey/channels?part=statistics&id=${channelId}`);
    const n = num(d?.items?.[0]?.statistics?.subscriberCount);
    if (n) return n;
  } catch {}
  // Layer 2b — Mixerno (usually CORS-open)
  try {
    const d = await fetchJson(`https://mixerno.space/api/youtube-channel-counter/user/${channelId}`);
    const entry = Array.isArray(d?.counts) ? d.counts.find((c: any) => c?.value === 'subscribers') : null;
    const n = num(entry?.count);
    if (n) return n;
  } catch {}
  // Layer 2c — Piped mirrors (kavin.rocks is often dead, try several)
  const mirrors = [
    'https://pipedapi.adminforge.de',
    'https://pipedapi.reallyaweso.me',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.kavin.rocks',
  ];
  for (const m of mirrors) {
    try {
      const d = await fetchJson(`${m}/channel/${channelId}`, 7000);
      const n = num(d?.subscriberCount);
      if (n) return n;
    } catch {}
  }
  return FALLBACK.youtube;
}

export async function getWhatsAppSubscribers(): Promise<number> {
  return (await viaServerApi('whatsapp')) ?? FALLBACK.whatsapp;
}

export async function getAllSocialMediaStats(): Promise<SocialMediaStats> {
  const [instagram, tiktok, twitter, youtube, whatsapp] = await Promise.all([
    getInstagramFollowers('absq'),
    getTikTokFollowers('iabsq'),
    getTwitterFollowers('iABSq'),
    getYouTubeSubscribers('UCdIM7MB-8G-FgE7ld3XAQ8w'),
    getWhatsAppSubscribers(),
  ]);
  const stats = { instagram, tiktok, twitter, youtube, whatsapp };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stats }));
  } catch {}
  return stats;
}

/** Instant paint from cache (if fresh), so numbers show before the live fetch lands. */
export function readSocialCache(): (SocialMediaStats & { _fresh: boolean }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, stats } = JSON.parse(raw);
    if (!stats) return null;
    return { ...stats, _fresh: Date.now() - at < SOCIAL_TTL_MS };
  } catch {
    return null;
  }
}

export function formatFollowerCount(count: number): string {
  const trim = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));
  if (count >= 1000000) return `${trim(count / 1000000)}M+`;
  if (count >= 1000) return `${trim(count / 1000)}K+`;
  return count.toString();
}

export async function getCachedSocialMediaStats(): Promise<SocialMediaStats> {
  return getAllSocialMediaStats();
}
