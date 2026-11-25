// Vercel Edge Function — Live Social Counters API
// GET /api/social?platform=tiktok|instagram|youtube|twitter
// Server-side fetch = no CORS issues, fresh numbers every call.
// Vercel caches success responses for 4 minutes (s-maxage).

export const config = {
  runtime: 'edge',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_SHORT = 'Mozilla/5.0';
const UA_BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const HANDLES = {
  tiktok: 'iabsq',
  instagram: 'absq',
  twitter: 'iABSq',
  youtube: 'UCdIM7MB-8G-FgE7ld3XAQ8w',
  whatsapp: '0029VadbqYx5Ui2eInkr7v2E',
} as const;

type Platform = keyof typeof HANDLES;

async function fetchJson(url: string, timeoutMs = 9000, ua = UA, extra?: Record<string, string>): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9', ...extra },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 9000, ua = UA): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/** "68,337" | "68.3K" | "1.2M" -> 68337 */
function parseCompact(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);
  const s = String(input ?? '').replace(/,/g, '').trim();
  const m = s.match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || '').toUpperCase();
  if (u === 'K') n *= 1e3;
  else if (u === 'M') n *= 1e6;
  else if (u === 'B') n *= 1e9;
  const out = Math.round(n);
  return out > 0 ? out : null;
}

async function getTikTok(): Promise<{ count: number; source: string }> {
  // 1) TokCount — Next.js page embeds exact "stats":{"followers":N} server-side
  try {
    const html = await fetchText(`https://tokcount.com/?user=${HANDLES.tiktok}`, 12000, UA_SHORT);
    const m = html.match(/"followers":(\d+)/);
    const n = m ? parseCompact(m[1]) : null;
    if (n) return { count: n, source: 'tokcount' };
  } catch {}
  // 2) Countik
  try {
    const d = await fetchJson(`https://countik.com/api/tiktok/@${HANDLES.tiktok}`);
    const n = parseCompact(d?.followerCount ?? d?.followers ?? d?.follower_count);
    if (n) return { count: n, source: 'countik' };
  } catch {}
  throw new Error('tiktok: all sources failed');
}

async function getYouTube(): Promise<{ count: number; source: string }> {
  // 1) LemnosLife operational API — exact subscriber count, no key
  try {
    const d = await fetchJson(`https://yt.lemnoslife.com/noKey/channels?part=statistics&id=${HANDLES.youtube}`);
    const n = parseCompact(d?.items?.[0]?.statistics?.subscriberCount);
    if (n) return { count: n, source: 'lemnoslife' };
  } catch {}
  // 2) Mixerno — exact subscriber count
  try {
    const d = await fetchJson(`https://mixerno.space/api/youtube-channel-counter/user/${HANDLES.youtube}`);
    const entry = Array.isArray(d?.counts) ? d.counts.find((c: any) => c?.value === 'subscribers') : null;
    const n = parseCompact(entry?.count);
    if (n) return { count: n, source: 'mixerno' };
  } catch {}
  // 3) Piped mirrors (kavin.rocks is often dead — try several)
  const mirrors = [
    'https://pipedapi.adminforge.de',
    'https://pipedapi.reallyaweso.me',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.kavin.rocks',
  ];
  for (const m of mirrors) {
    try {
      const d = await fetchJson(`${m}/channel/${HANDLES.youtube}`);
      const n = parseCompact(d?.subscriberCount);
      if (n) return { count: n, source: `piped:${new URL(m).hostname}` };
    } catch {}
  }
  throw new Error('youtube: all sources failed');
}

async function getTwitter(): Promise<{ count: number; source: string }> {
  // 1) FixTweet — exact followers. Full Chrome UAs get bogus 404s; short UA works,
  //    but the service answers transient 404s for valid handles — retry with backoff.
  for (let i = 0; i < 4; i++) {
    try {
      const d = await fetchJson(`https://api.fxtwitter.com/${HANDLES.twitter}`, 9000, UA_SHORT);
      const n = parseCompact(d?.user?.followers);
      if (n) return { count: n, source: 'fxtwitter' };
    } catch {}
    if (i < 3) await new Promise(r => setTimeout(r, 700));
  }
  // 2) X syndication endpoint
  try {
    const d = await fetchJson(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${HANDLES.twitter}`
    );
    const n = parseCompact(Array.isArray(d) ? d[0]?.followers_count : d?.followers_count);
    if (n) return { count: n, source: 'syndication' };
  } catch {}
  throw new Error('twitter: all sources failed');
}

async function getInstagram(): Promise<{ count: number; source: string }> {
  // 1) Instagram private web API (works server-side when not walled)
  try {
    const d = await fetchJson(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${HANDLES.instagram}`,
      9000, UA, { 'x-ig-app-id': '936619743392459' }
    );
    const n = parseCompact(d?.data?.user?.edge_followed_by?.count);
    if (n) return { count: n, source: 'web_profile_info' };
  } catch {}
  // 2) og:description meta ("27K Followers, ...") — Googlebot UA gets the full page
  try {
    const html = await fetchText(`https://www.instagram.com/${HANDLES.instagram}/`, 12000, UA_BOT);
    const og = html.match(/property="og:description"\s+content="([^"]+)"/)?.[1] || '';
    const m = og.match(/([\d.,]+[KMB]?)\s+Followers/i);
    const n = m ? parseCompact(m[1]) : null;
    if (n) return { count: n, source: 'og_description' };
  } catch {}
  throw new Error('instagram: all sources failed (login-walled)');
}

async function getWhatsApp(): Promise<{ count: number; source: string }> {
  // Public WhatsApp Channel page — server-side fetch exposes the live follower count.
  const html = await fetchText(`https://www.whatsapp.com/channel/${HANDLES.whatsapp}`, 12000);
  const og = html.match(/property="og:description"\s+content="([^"]+)"/)?.[1] || '';
  const m =
    og.match(/([\d.,]+[KMB]?)\s*followers/i) ||
    html.match(/([\d.,]+[KMB]?)\s*followers/i);
  const n = m ? parseCompact(m[1]) : null;
  if (n) return { count: n, source: 'whatsapp_channel_page' };
  throw new Error('whatsapp: follower count not found');
}

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get('platform') || '').toLowerCase() as Platform;

  if (!platform || !(platform in HANDLES)) {
    return new Response(JSON.stringify({ error: 'Use ?platform=tiktok|instagram|youtube|twitter|whatsapp' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const loaders: Record<Platform, () => Promise<{ count: number; source: string }>> = {
      tiktok: getTikTok,
      instagram: getInstagram,
      youtube: getYouTube,
      twitter: getTwitter,
      whatsapp: getWhatsApp,
    };
    const { count, source } = await loaders[platform]();
    return new Response(JSON.stringify({ platform, count, source, updatedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=240, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ platform, count: null, error: err?.message || 'failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=60' },
    });
  }
}
