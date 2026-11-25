import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChannelInfo, Language, LeaderboardData, LeaderboardEntry } from '../types';
import './SupportersHall.css';

interface SupportersHallProps {
  lang: Language;
  channelInfo: ChannelInfo;
  leaderboards: LeaderboardData;
}

type BoardKey = 'best' | 'week' | 'month';
type Row = [string, number];

const KICK_URL = 'https://kick.com/iabs';
const SUB_URL = 'https://kick.com/iabs/subscribe';

const fmt = (n: number) => Math.round(n).toLocaleString('en');

const RANKS = [
  { k: '1M', g: '#c8ccd2', ar: { n: 'الشرارة', d: 'من هنا تبدأ الحكاية. شهر واحد وشرارتك اشتعلت.' }, en: { n: 'The Spark', d: 'Where the story begins. One month and your spark caught fire.' } },
  { k: '2M', g: '#d49548', ar: { n: 'الجمر', d: 'شهران والجمر ما انطفى.' }, en: { n: 'The Ember', d: 'Two months in and the ember never went out.' } },
  { k: '3M', g: '#b44cf0', ar: { n: 'الغسق', d: 'ثلاثة أشهر… وظلّك صار معروف بالساحة.' }, en: { n: 'The Dusk', d: 'Three months… your shadow is known across the arena.' } },
  { k: '6M', g: '#ff8a2b', ar: { n: 'اللهيب', d: 'نصف سنة والنار ما تهدأ.' }, en: { n: 'The Blaze', d: 'Half a year and the fire never dies down.' } },
  { k: '9M', g: '#3d8bff', ar: { n: 'العاصفة', d: 'تسعة أشهر ثبتّ فيها قدّام كل عاصفة.' }, en: { n: 'The Storm', d: 'Nine months standing tall through every storm.' } },
  { k: '1Y', g: '#ff3b3b', ar: { n: 'القرمزي', d: 'سنة كاملة. اسمك انكتب بالقرمزي.' }, en: { n: 'The Crimson', d: 'A full year. Your name written in crimson.' } },
  { k: '2Y', g: '#bfe9ff', ar: { n: 'الخالد', d: 'سنتان. أعلى رتبة وأندر لقب بالقناة.' }, en: { n: 'The Immortal', d: 'Two years. The highest rank and rarest title in the channel.' } },
];

const Crown = () => (
  <svg className="crown" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 18h18l1.5-11-5.5 4.5L12 4 7 11.5 1.5 7 3 18zm1 2h16v2H4z" />
  </svg>
);

export const SupportersHall: React.FC<SupportersHallProps> = ({ lang, channelInfo, leaderboards }) => {
  const ar = lang !== 'en';
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number>(0);
  const [rank, setRank] = useState(6);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [modalUser, setModalUser] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const META: Record<BoardKey, { t: string; s: string }> = ar
    ? { best: { t: 'الأساطير', s: 'الأفضل على الإطلاق' }, week: { t: 'أسبوعياً', s: 'نجوم هذا الأسبوع' }, month: { t: 'شهرياً', s: 'أبطال هذا الشهر' } }
    : { best: { t: 'Legends', s: 'Best of all time' }, week: { t: 'Weekly', s: 'Stars of this week' }, month: { t: 'Monthly', s: 'Heroes of this month' } };

  const boards = useMemo(() => {
    const prep = (list: LeaderboardEntry[] | undefined): Row[] =>
      [...(list || [])]
        // Kick can return placeholder rows (for example username "X" with 0 gifts)
        // while the leaderboard is unavailable. Never render those as a real card.
        .filter(e => typeof e?.username === 'string' && e.username.trim().length > 0 && Number(e.quantity) > 0)
        .sort((a, b) => Number(b.quantity) - Number(a.quantity))
        .slice(0, 10)
        .map(e => [e.username.trim(), Number(e.quantity)]);
    return { best: prep(leaderboards.gifts), week: prep(leaderboards.gifts_week), month: prep(leaderboards.gifts_month) };
  }, [leaderboards]);

  const all = useMemo(() => {
    const m: Record<string, Partial<Record<BoardKey, number>>> = {};
    (Object.keys(boards) as BoardKey[]).forEach(k => boards[k].forEach(([u, v]) => { (m[u] = m[u] || {})[k] = v; }));
    return m;
  }, [boards]);

  const sumG = (L: Row[]) => L.reduce((s, x) => s + x[1], 0);
  const BT = sumG(boards.best);
  const followers = Number(channelInfo.followers_count) || 0;
  const goal = Math.max(10000, Math.ceil((followers + 1) / 10000) * 10000);
  const goalPct = Math.min(100, Math.round((followers / goal) * 100));

  const showToast = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* reveal + count-up + progress bars */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rafs = new Set<number>();
    const cu = (el: HTMLElement) => {
      const n = +(el.dataset.n || 0);
      if (el.dataset.cu === String(n)) return;
      el.dataset.cu = String(n);
      if (reduce) { el.textContent = fmt(n); return; }
      let t0: number | null = null;
      const step = (t: number) => {
        t0 = t0 ?? t;
        const p = Math.min(1, (t - t0) / 1400);
        el.textContent = fmt(n * (1 - Math.pow(1 - p, 3)));
        if (p < 1) { const id = requestAnimationFrame(step); rafs.add(id); }
      };
      rafs.add(requestAnimationFrame(step));
    };
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target as HTMLElement;
      el.classList.add('in');
      el.querySelectorAll<HTMLElement>('[data-n]').forEach(cu);
      el.querySelectorAll<HTMLElement>('[data-w]').forEach(b => { b.style.width = b.dataset.w + '%'; });
      io.unobserve(el);
    }), { threshold: .12 });
    root.querySelectorAll('.rv').forEach(e => io.observe(e));
    return () => { io.disconnect(); rafs.forEach(id => cancelAnimationFrame(id)); };
  }, [boards, followers, lang]);

  /* modal: body scroll lock + Escape */
  useEffect(() => {
    if (!modalUser) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalUser(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [modalUser]);

  const jump = (k: BoardKey) => {
    const el = rootRef.current?.querySelector('#shx-sec-' + k);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const share = (u: string) => {
    const text = ar ? `${u} من كبار داعمي ABS` : `${u} — one of ABS top supporters`;
    try {
      navigator.clipboard.writeText(text).then(
        () => showToast(ar ? 'تم النسخ' : 'Copied'),
        () => showToast(ar ? 'تعذّر النسخ' : 'Copy failed')
      );
    } catch { showToast(ar ? 'تعذّر النسخ' : 'Copy failed'); }
  };

  const q = query.trim().toLowerCase();
  const cardState = (u: string) =>
    (hovered === u ? ' hl' : '') + (q && !u.toLowerCase().includes(q) ? ' dim' : '');
  const hoverProps = (u: string) => ({
    'data-u': u,
    onMouseEnter: () => setHovered(u),
    onMouseLeave: () => setHovered(null),
    onClick: () => setModalUser(u),
  });

  const roster = (k: BoardKey) => {
    const L = boards[k];
    const head = (
      <div className="rh">
        <span className="tt">{META[k].t}</span>
        <h3>{META[k].s}</h3>
        <span className="ln"></span>
        <small>{ar ? `${fmt(sumG(L))} هدية · ${L.length} داعمين` : `${fmt(sumG(L))} gifts · ${L.length} supporters`}</small>
      </div>
    );
    if (L.length === 0) {
      return (
        <section className={`sec ${k} rv`} id={'shx-sec-' + k}>
          {head}
          <div className="empty cut">{ar ? 'لا يوجد داعمين في هذه الفترة بعد' : 'No supporters in this period yet'}</div>
        </section>
      );
    }
    const tot = sumG(L), mx = L[0][1];
    const feat = L.slice(0, 3).map(([u, v], i) => {
      const r = i + 1, first = i === 0;
      return (
        <button key={u} type="button" className={`pc cut${first ? ' r1' : ' wide'}${cardState(u)}`} {...hoverProps(u)}>
          <span className="gh">{r}</span>
          {!first && <span className="rb">#{r}</span>}
          <div className="tp">
            {first && <><Crown /><span className="kg">{ar ? 'المتصدر' : 'TOP DONOR'}</span></>}
            <div className="dm">{u[0].toUpperCase()}</div>
            <div className="nm">{u}<small>{Math.round((v / tot) * 100)}{ar ? '% من الهدايا' : '% of gifts'}</small></div>
          </div>
          <div className="ct"><b data-n={v}>0</b>{ar ? 'هدية' : 'gifts'}</div>
          <div className="sb"><i data-w={(v / mx) * 100}></i></div>
        </button>
      );
    });
    const list = L.slice(3).map(([u, v], i) => {
      const r = i + 4;
      return (
        <button key={u} type="button" className={`lr${cardState(u)}`} {...hoverProps(u)}>
          <span className="rn">{('0' + r).slice(-2)}</span>
          <div className="dm">{u[0].toUpperCase()}</div>
          <div>
            <div className="n2">{u}</div>
            <div className="sb"><i data-w={(v / mx) * 100}></i></div>
          </div>
          <div className="c2"><b data-n={v}>0</b><small>{ar ? 'هدية' : 'gifts'}</small></div>
        </button>
      );
    });
    return (
      <section className={`sec ${k} rv`} id={'shx-sec-' + k}>
        {head}
        <div className={`ros${L.length < 3 ? ' few' : ''}${L.length === 1 ? ' one' : ''}`}>{feat}</div>
        {list.length > 0 && <div className="lst cut">{list}</div>}
      </section>
    );
  };

  const modal = (() => {
    if (!modalUser) return null;
    const u = modalUser;
    const d = all[u] || {};
    const i = boards.best.findIndex(x => x[0] === u) + 1;
    const g = d.best || 0;
    const C: Record<BoardKey, string> = { best: 'var(--red)', month: 'var(--month)', week: 'var(--week)' };
    return (
      <div className="md cut">
        <button type="button" className="x" aria-label={ar ? 'إغلاق' : 'Close'} onClick={() => setModalUser(null)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div className="dm">{u[0].toUpperCase()}</div>
        <div>
          <h3>{u}</h3>
          {i > 0 && <span className="bg">{ar ? `المركز ${i} في الأساطير · ${BT ? Math.round((g / BT) * 100) : 0}%` : `Rank ${i} in Legends · ${BT ? Math.round((g / BT) * 100) : 0}%`}</span>}
        </div>
        <div className="ml">
          {(['best', 'month', 'week'] as BoardKey[]).map(k => {
            const ix = boards[k].findIndex(x => x[0] === u);
            const v = d[k] || 0;
            const top = boards[k][0]?.[1] || 1;
            return (
              <div key={k}>
                <div className="l">
                  <span>{META[k].t}</span>
                  <b>{v ? (ar ? `${v} هدية · المركز ${ix + 1}` : `${v} gifts · rank ${ix + 1}`) : (ar ? 'لا يوجد' : 'None')}</b>
                </div>
                <div className="sb"><i style={{ width: `${(v / top) * 100}%`, background: C[k] }}></i></div>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn" onClick={() => share(u)}>{ar ? 'شارك الترتيب' : 'Share rank'}</button>
      </div>
    );
  })();

  const rk = RANKS[rank];
  const rkL = ar ? rk.ar : rk.en;

  return (
    <div className="shx" dir={ar ? 'rtl' : 'ltr'} ref={rootRef}>
      <main className="wrap">
        <section className="hero cut rv">
          <div className="hl1">
            <div className="id">
              <div className="lg"><img src="/hall/logo.png" alt="" /></div>
              <div>
                <small><i></i>{ar ? 'القناة الرسمية على كيك' : 'The official Kick channel'}</small>
                <div className="num">
                  <span data-n={followers} style={{ display: 'inline', font: 'inherit', color: 'inherit', margin: 0 }}>0</span>
                  <span>{ar ? 'متابع' : 'followers'}</span>
                </div>
              </div>
            </div>
            <div className="goal">
              <div>
                <span>{ar ? <>الهدف القادم: <b>{fmt(goal)}</b> متابع</> : <>Next goal: <b>{fmt(goal)}</b> followers</>}</span>
                <b>{goalPct}%</b>
              </div>
              <div className="gb"><i data-w={goalPct}></i></div>
            </div>
            <div className="acts">
              <a className="btn" href={KICK_URL} target="_blank" rel="noopener noreferrer">{ar ? 'تابع الآن' : 'Follow now'}</a>
              <a className="btn g" href={SUB_URL} target="_blank" rel="noopener noreferrer">{ar ? 'أهدِ اشتراكاً' : 'Gift a sub'}</a>
            </div>
          </div>
          <div className="hr">
            <h3>{ar ? 'رتب المشتركين' : 'Subscriber ranks'}<span>{ar ? 'اضغط على أي رتبة' : 'Tap any rank'}</span></h3>
            <div className="steps">
              {RANKS.map((r, i) => (
                <button key={r.k} type="button" className={'st' + (rank === i ? ' on' : '')} style={{ '--g': r.g } as React.CSSProperties}
                  aria-label={(ar ? 'رتبة ' : 'Rank ') + (ar ? r.ar.n : r.en.n)} onClick={() => setRank(i)}>
                  <img src={`/hall/rank-${i + 1}.png`} alt={r.k} loading="lazy" />
                  <b>{r.k}</b>
                </button>
              ))}
            </div>
            <div>
              <div className="show cut" style={{ '--g': rk.g } as React.CSSProperties} key={rank}>
                <img src={`/hall/rank-${rank + 1}.png`} alt={rk.k} />
                <div>
                  <small>{ar ? `الرتبة ${rank + 1} من ${RANKS.length} · ${rk.k}` : `Rank ${rank + 1} of ${RANKS.length} · ${rk.k}`}</small>
                  <h4>{rkL.n}</h4>
                  <p>{rkL.d}</p>
                  <div className="lv">{RANKS.map((_, j) => <i key={j} className={j <= rank ? 'f' : ''}></i>)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sh rv">
          <span className="num">03</span>
          <div className="tx">
            <span className="tag">HALL OF FAME</span>
            <h2>{ar ? 'كبار الداعمين' : 'Top Supporters'}</h2>
            <p>{ar ? 'أكثر من أهدوا اشتراكات للبث. اضغط على أي داعم لتشوف إحصائياته.' : 'The most gifted subs to the stream. Tap any supporter to see their stats.'}</p>
            <div className="jump">
              <button type="button" onClick={() => jump('best')}>{META.best.t}</button>
              <button type="button" onClick={() => jump('week')}>{META.week.t}</button>
              <button type="button" onClick={() => jump('month')}>{META.month.t}</button>
            </div>
          </div>
          <span className="ln"></span>
        </section>

        <div className="sum rv">
          <div className="sm cut"><b data-n={BT}>0</b><span>{ar ? <>إجمالي<br />الهدايا</> : <>Total<br />gifts</>}</span></div>
          <div className="sm cut"><b data-n={Object.keys(all).length}>0</b><span>{ar ? <>عدد<br />الداعمين</> : <>Unique<br />supporters</>}</span></div>
          <div className="sm cut"><b data-n={boards.best[0]?.[1] || 0}>0</b><span>{ar ? <>أكبر عدد هدايا<br />لداعم</> : <>Most gifts<br />by one supporter</>}</span></div>
        </div>

        <label className="search cut rv">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث عن داعم بالاسم' : 'Search supporters by name'} aria-label={ar ? 'بحث' : 'Search'} />
        </label>

        <div style={{ display: 'grid', gap: 40 }}>
          {roster('best')}
          <div className="pair">
            {roster('week')}
            {roster('month')}
          </div>
        </div>
      </main>

      {createPortal(
        <div className="shx shx-portal" dir={ar ? 'rtl' : 'ltr'}>
          <div className={'ov' + (modalUser ? ' on' : '')} role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) setModalUser(null); }}>
            {modal}
          </div>
          <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SupportersHall;
