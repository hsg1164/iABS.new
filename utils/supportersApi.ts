// Streamlabs + Creators public leaderboards — live data, no token required.
// Layers: 1) /api/kick proxy (dev + Vercel, no CORS) 2) direct fetch 3) local cache.
// NOTE: this module never returns demo / sample names. If the APIs fail and there
// is no cache, the caller gets an empty list so the UI can show a real empty state.

import { kickFetch } from './kickApi';

export interface TipDonor {
  name: string;
  rank: number;
}

export type TipInterval = 'all' | 'week' | 'month';
export type SupportPlatform = 'sl' | 'cr';

export interface SupportEntry {
  name: string;
  rank: number;
  /** Creators only — total support in SAR. Streamlabs does not expose amounts. */
  amount?: number;
  /** Creators only — ISO-ish date of the last donation. */
  lastAt?: string;
  platform: SupportPlatform;
}

export interface BoardResult {
  entries: SupportEntry[];
  /** true when this payload came from the live API in this session */
  live: boolean;
  at: number;
}

export type SupportBoards = Record<SupportPlatform, Record<TipInterval, BoardResult>>;

const SL_BASE = 'https://streamlabs.com/api/v6/59249eb4ac505bd/leaderboard/tip';
const CR_BASE = 'https://api.creators.sa/v1/kebab/unified/abs/leaderboard';

const API: Record<SupportPlatform, Record<TipInterval, string>> = {
  sl: {
    all: `${SL_BASE}?interval=all`,
    month: `${SL_BASE}?interval=month`,
    week: `${SL_BASE}?interval=week`,
  },
  cr: {
    all: `${CR_BASE}?limit=10&duration=lifetime`,
    month: `${CR_BASE}?limit=10&duration=monthly`,
    week: `${CR_BASE}?limit=10&duration=weekly`,
  },
};

const CACHE_PREFIX = 'iabs_support_v2_';
export const SUPPORT_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;

const PLATFORMS: SupportPlatform[] = ['sl', 'cr'];
const INTERVALS: TipInterval[] = ['week', 'month', 'all'];

/* ------------------------------------------------------------------ */
/* cache                                                              */
/* ------------------------------------------------------------------ */

interface CachedBoard {
  at: number;
  entries: SupportEntry[];
}

function cacheKey(platform: SupportPlatform, interval: TipInterval): string {
  return `${CACHE_PREFIX}${platform}_${interval}`;
}

function readCache(platform: SupportPlatform, interval: TipInterval): CachedBoard | null {
  try {
    const raw = localStorage.getItem(cacheKey(platform, interval));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    const entries = parsed.entries.filter(
      (e: any) => e && typeof e.name === 'string' && e.name.trim()
    );
    if (!entries.length) return null;
    return { at: Number(parsed.at) || 0, entries };
  } catch {
    return null;
  }
}

function writeCache(platform: SupportPlatform, interval: TipInterval, entries: SupportEntry[]): void {
  try {
    localStorage.setItem(
      cacheKey(platform, interval),
      JSON.stringify({ at: Date.now(), entries })
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

/* ------------------------------------------------------------------ */
/* normalizers                                                        */
/* ------------------------------------------------------------------ */

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}

function num(v: any): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  for (const key of ['donors', 'data', 'items', 'leaderboard', 'results', 'supporters', 'entries', 'list', 'users']) {
    const v = (input as any)[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const nested = pickArray(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

/** Streamlabs returns one row per tip, so the same donor can appear many times.
 *  Keep the first (best) rank for each name, then re-rank cleanly. */
function normalizeSl(input: any): SupportEntry[] {
  const rows = pickArray(input);
  const seen = new Set<string>();
  const out: SupportEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const name = str(row.name) || str(row.username) || str(row.donor_name) || str(row.from);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: name.slice(0, 40),
      rank: out.length + 1,
      platform: 'sl',
    });
  }
  return out;
}

/** Creators returns { uname, total, last_donation_at }. If a name appears twice,
 *  sum the amounts so the ranking stays truthful. */
function normalizeCr(input: any): SupportEntry[] {
  const rows = pickArray(input);
  const map = new Map<string, SupportEntry>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const name = str(row.uname) || str(row.name) || str(row.username) || str(row.user);
    const key = name.toLowerCase();
    if (!name) continue;
    const amount = num(row.total) ?? num(row.amount) ?? num(row.value);
    const lastAt = str(row.last_donation_at) || str(row.lastDonationAt) || undefined;
    const prev = map.get(key);
    if (prev) {
      prev.amount = (prev.amount || 0) + (amount || 0);
      if (lastAt && (!prev.lastAt || lastAt > prev.lastAt)) prev.lastAt = lastAt;
    } else {
      map.set(key, {
        name: name.slice(0, 40),
        rank: 0,
        amount,
        lastAt,
        platform: 'cr',
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0) || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/* ------------------------------------------------------------------ */
/* network                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string): Promise<any | null> {
  // 1) our own proxy — works in `vite dev` and on Vercel, no browser CORS issues
  try {
    const proxied = await Promise.race([
      kickFetch(url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS)),
    ]);
    if (proxied && typeof proxied === 'object') return proxied;
  } catch {
    /* fall through */
  }

  // 2) direct fetch (creators.sa allows CORS in most regions)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }

  return null;
}

async function loadBoard(
  platform: SupportPlatform,
  interval: TipInterval,
  force: boolean
): Promise<BoardResult> {
  const cached = readCache(platform, interval);
  const fresh = cached && Date.now() - cached.at <= SUPPORT_TTL_MS;

  if (!force && fresh && cached) {
    return { entries: cached.entries, live: true, at: cached.at };
  }

  const json = await fetchJson(API[platform][interval]);
  const entries = platform === 'sl' ? normalizeSl(json) : normalizeCr(json);

  if (entries.length) {
    writeCache(platform, interval, entries);
    return { entries, live: true, at: Date.now() };
  }

  // network failed — stale cache is still real data, just older
  if (cached?.entries.length) {
    return { entries: cached.entries, live: false, at: cached.at };
  }

  return { entries: [], live: false, at: Date.now() };
}

function emptyBoards(): SupportBoards {
  const board = (): Record<TipInterval, BoardResult> => ({
    week: { entries: [], live: false, at: 0 },
    month: { entries: [], live: false, at: 0 },
    all: { entries: [], live: false, at: 0 },
  });
  return { sl: board(), cr: board() };
}

/** Fetch all six public leaderboards (2 platforms × 3 periods) in parallel. */
export async function getSupportBoards(force = false): Promise<SupportBoards> {
  const pairs: [SupportPlatform, TipInterval][] = [];
  PLATFORMS.forEach((p) => INTERVALS.forEach((i) => pairs.push([p, i])));

  const results = await Promise.all(pairs.map(([p, i]) => loadBoard(p, i, force)));
  const boards = emptyBoards();
  pairs.forEach(([p, i], idx) => {
    boards[p][i] = results[idx];
  });
  return boards;
}

/* ------------------------------------------------------------------ */
/* combined ranking                                                   */
/* ------------------------------------------------------------------ */

export interface CombinedEntry {
  key: string;
  name: string;
  points: number;
  platforms: SupportPlatform[];
  bestRank: number;
  amount?: number;
}

/**
 * Merge both platforms into one fair ranking.
 * Each platform contributes a rank score: rank #1 → 1.0, last rank → 1/n.
 * A donor present on both platforms naturally rises to the top.
 */
export function combineSupport(
  boards: Record<SupportPlatform, SupportEntry[]>
): CombinedEntry[] {
  const map = new Map<string, CombinedEntry>();

  PLATFORMS.forEach((platform) => {
    const list = boards[platform] || [];
    const n = list.length;
    if (!n) return;

    list.forEach((entry, index) => {
      const name = entry.name.trim();
      const key = name.toLowerCase();
      if (!key) return;

      let combined = map.get(key);
      if (!combined) {
        combined = {
          key,
          name,
          points: 0,
          platforms: [],
          bestRank: Number.MAX_SAFE_INTEGER,
        };
        map.set(key, combined);
      }

      combined.points += (n - index) / n;
      if (!combined.platforms.includes(platform)) combined.platforms.push(platform);
      combined.bestRank = Math.min(combined.bestRank, index + 1);
      if (typeof entry.amount === 'number') {
        combined.amount = (combined.amount || 0) + entry.amount;
      }
    });
  });

  return [...map.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.platforms.length - a.platforms.length ||
        a.bestRank - b.bestRank ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* backward-compatible helper (used by older widgets)                 */
/* ------------------------------------------------------------------ */

export async function getTipLeaderboard(interval: TipInterval): Promise<TipDonor[]> {
  const result = await loadBoard('sl', interval, false);
  return result.entries.map((e, i) => ({ name: e.name, rank: i + 1 }));
}
