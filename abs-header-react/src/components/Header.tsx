import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import logo from "../assets/logo.png";
import { I18N, NAV, type Lang } from "./data";
import { buildFrame } from "./frame";
import "../styles/header.css";

const FLASH_MS = 420;

interface HeaderProps {
  /** Controlled language from the application shell. */
  lang?: Lang;
  /** Called when the user presses the language switch. */
  onToggleLang?: () => void;
}

export default function Header({ lang: controlledLang, onToggleLang }: HeaderProps = {}) {
  const hdRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [fast, setFast] = useState(false);
  const [prog, setProg] = useState(0);
  const [active, setActive] = useState("");
  const [localLang, setLocalLang] = useState<Lang>("ar");
  const [spin, setSpin] = useState(0);
  const [ind, setInd] = useState({ left: 0, width: 0, on: false });
  const [fontsTick, setFontsTick] = useState(0);

  const glitchT = useRef<number>();
  const fastT = useRef<number>();
  const scrolledRef = useRef(false);

  /** فلاش + ارتجاج الإطار */
  const flash = useCallback(() => {
    setGlitch(true);
    window.clearTimeout(glitchT.current);
    glitchT.current = window.setTimeout(() => setGlitch(false), FLASH_MS);
  }, []);

  /* قياس الهيدر (يعاد رسم الإطار مع كل إطار أثناء الانتقال) */
  useLayoutEffect(() => {
    const el = hdRef.current!;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { document.fonts?.ready.then(() => setFontsTick(t => t + 1)); }, []);

  /* التمرير: تصغير + غلتش + سرعة الإضاءة + تقدّم + تتبّع القسم */
  const lang = controlledLang ?? localLang;
  const toggleLang = () => {
    if (onToggleLang) onToggleLang();
    else setLocalLang(l => (l === "ar" ? "en" : "ar"));
    flash();
  };

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const run = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProg(max > 0 ? y / max : 0);
      const now = y > 40;
      if (now !== scrolledRef.current) { scrolledRef.current = now; setScrolled(now); flash(); }
      if (Math.abs(y - last) > 40) {
        setFast(true);
        window.clearTimeout(fastT.current);
        fastT.current = window.setTimeout(() => setFast(false), 400);
      }
      last = y;
      let cur = "";
      NAV.forEach(n => {
        const s = document.getElementById(n.id);
        if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) cur = n.id;
      });
      setActive(cur);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; run(); });
    };
    run();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [flash]);

  /* اللغة والاتجاه */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  /* مؤشر الرابط النشط */
  useLayoutEffect(() => {
    const i = NAV.findIndex(n => n.id === active);
    const a = i >= 0 ? linkRefs.current[i] : null;
    if (!a || size.w <= 900) { setInd(v => ({ ...v, on: false })); return; }
    setInd({ left: a.offsetLeft, width: a.offsetWidth, on: true });
  }, [active, lang, size.w, fontsTick]);

  const f = useMemo(
    () => (size.w ? buildFrame({ w: size.w, h: size.h, compact: scrolled, open, prog }) : null),
    [size, scrolled, open, prog]
  );

  const t = I18N[lang];
  const cls = ["hd", scrolled && "sc", open && "open", glitch && "gl", fast && "fast"].filter(Boolean).join(" ");

  return createPortal(
    <div className="abs-header-scope">
    <header className={cls} ref={hdRef}>
      <div className="bg" style={{ clipPath: f?.clip }} />

      <svg className="fr" aria-hidden="true">
        <defs>
          <linearGradient id="gr">
            <stop offset="0" stopColor="#ff2f3a" stopOpacity="0" />
            <stop offset=".5" stopColor="#ffd0d3" />
            <stop offset="1" stopColor="#ff2f3a" stopOpacity="0" />
          </linearGradient>
          <filter id="gl" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {f && (
          <>
            <path className="f-base" d={f.base} pathLength={1000} />
            <path className="f-run" d={f.base} pathLength={1000} />
            <path className="f-run b" d={f.base} pathLength={1000} />
            <path className="f-tick" d={f.tick} />
            <path className="f-br" d={f.bracket} />
            <line className="f-pg" x1={f.pg.x1} x2={f.pg.x2} y1={f.pg.y} y2={f.pg.y} style={{ opacity: f.pg.on ? 1 : 0 }} />
            <g>
              {f.nodes.map(([x, y], k) => (
                <rect key={k} className="nd" x={x - 3} y={y - 3} width={6} height={6} transform={`rotate(45 ${x} ${y})`} />
              ))}
            </g>
          </>
        )}
      </svg>

      <div className="in">
        <a className="brand" href="#home">
          <span className="bl"><img alt="iABS" src={logo} /><i className="on" /></span>
          <span className="bt"><b>i<em>ABS</em></b><small>{t.hub}</small></span>
        </a>

        <nav className="links">
          <span className="ind" style={{ left: ind.left, width: ind.width, opacity: ind.on ? 1 : 0 }} />
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} className={active === n.id ? "act" : undefined} ref={el => { linkRefs.current[i] = el; }}>
              {n.icon}<span>{n[lang]}</span>
            </a>
          ))}
        </nav>

        <div className="tl">
          <span className="st"><i /><b>{t.off}</b></span>
          <a className="ar" href="#archive">
            <span className="rg">
              <svg viewBox="0 0 30 30"><circle className="t" cx="15" cy="15" r="12" /><circle className="p" cx="15" cy="15" r="12" /></svg>
              <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10h14V9" /></svg></i>
            </span>
            <span><small>{t.arch2}</small><b>60 / 60</b></span>
          </a>
          <button key={spin} className={"nb" + (spin ? " spin" : "")} type="button" aria-label="refresh" onClick={() => setSpin(s => s + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" /></svg>
          </button>
          <button className="lang" type="button" onClick={toggleLang}>
            {lang === "ar" ? "EN" : "AR"}
          </button>
          <button className="nb burger" type="button" aria-label="menu" aria-expanded={open} onClick={() => { setOpen(o => !o); flash(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
          </button>
        </div>
      </div>

      <div className="drawer">
        <div onClick={() => setOpen(false)}>
          {NAV.map(n => (
            <a key={n.id} href={`#${n.id}`}>{n.icon}<span>{n[lang]}</span></a>
          ))}
        </div>
      </div>
    </header>
    </div>,
    document.body
  );
}
