import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { KickIcon, XIcon, SnapchatIcon, DiscordIcon, TikTokIcon, WhatsAppIcon, InstagramIcon, YoutubeIcon, FacebookIcon, MailIcon } from './components/Icons';
import { SocialLink, Language } from './types';
import { supabase } from './supabaseClient';
const SponsorsSection = lazy(() => import('./components/PublicWidgets').then(m => ({ default: m.SponsorsSection })));
const ClipsSection = lazy(() => import('./components/PublicWidgets').then(m => ({ default: m.ClipsSection })));
const ScheduleSection = lazy(() => import('./components/PublicWidgets').then(m => ({ default: m.ScheduleSection })));
const FAQSection = lazy(() => import('./components/PublicWidgets').then(m => ({ default: m.FAQSection })));
import { StreamPlayer } from './components/StreamPlayer';
const SocialArena = lazy(() => import('./components/ArenaSections').then(m => ({ default: m.SocialArena })));
const CommunityHQ = lazy(() => import('./components/ArenaSections').then(m => ({ default: m.CommunityHQ })));
import type { ArenaStats } from './components/ArenaSections';
import AbsHeader from './abs-header-react/src/components/Header';
import HomeHero from './components/HomeHero';
const SessionReport = lazy(() => import('./components/SessionReport'));

// Heavy below-fold / on-demand chunks — split out of the first paint
const StatsSection = lazy(() => import('./components/StatsSection').then(m => ({ default: m.StatsSection })));
const ModeratorsSection = lazy(() => import('./components/ModeratorsSection'));
const SupportSection = lazy(() => import('./components/SupportSection'));
// الشات يجيب معه pusher-js (~70KB) — ينزّل فقط وقت البث المباشر
const ChatWidget = lazy(() => import('./components/Chat').then(m => ({ default: m.ChatWidget })));

// --- Constants (preserved) ---
const DEFAULT_PROFILE_IMAGE = "favicon-192.png";
import { kickFetch } from './utils/kickApi';
import { getAllSocialMediaStats, formatFollowerCount, readSocialCache, SOCIAL_TTL_MS, FALLBACK } from './utils/socialMediaApi';

const PC_BACKGROUND = "abs-home-background.jpg";
const MOBILE_BACKGROUND = "abs-home-background-mobile.jpg";
const CHANNEL_SLUG = 'iabs';

const createSocialLink = (key: string, value: string, followerCount?: string, specialDetail?: string): SocialLink | null => {
    if (!value) return null;
    const handle = value.replace(/^https?:\/\/(www\.)?(twitter|x|instagram|youtube|discord|tiktok|facebook|snapchat|whatsapp)\.com\//i, '')
        .replace(/\/channel\//i, '')
        .replace(/^@/, '')
        .replace(/\/$/, '');
    switch (key) {
        case 'twitter': return { name: 'X', url: value.startsWith('http') ? value : `https://x.com/${handle}`, icon: <XIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FFFFFF', followerCount, specialDetail };
        case 'instagram': return { name: 'Instagram', url: value.startsWith('http') ? value : `https://instagram.com/${handle}`, icon: <InstagramIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#E1306C', followerCount, specialDetail };
        case 'youtube': return { name: 'YouTube', url: value.startsWith('http') ? value : `https://youtube.com/@${handle}`, icon: <YoutubeIcon className="w-7 h-7" />, color: '', username: 'Channel', hex: '#FF0000', followerCount, specialDetail };
        case 'discord': return { name: 'Discord', url: value.startsWith('http') ? value : `https://discord.gg/${handle}`, icon: <DiscordIcon className="w-7 h-7" />, color: '', username: 'Community', hex: '#5865F2', followerCount, specialDetail };
        case 'tiktok': return { name: 'TikTok', url: value.startsWith('http') ? value : `https://tiktok.com/@${handle}`, icon: <TikTokIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FE2C55', followerCount, specialDetail };
        case 'facebook': return { name: 'Facebook', url: value.startsWith('http') ? value : `https://facebook.com/${handle}`, icon: <FacebookIcon className="w-7 h-7" />, color: '', username: 'Page', hex: '#1877F2', followerCount, specialDetail };
        case 'snapchat': return { name: 'Snapchat', url: value.startsWith('http') ? value : `https://snapchat.com/add/${handle}`, icon: <SnapchatIcon className="w-7 h-7" />, color: '', username: 'iabsq', hex: '#FFFC00', followerCount, specialDetail };
        case 'whatsapp': return { name: 'WhatsApp', url: value, icon: <WhatsAppIcon className="w-7 h-7" />, color: '', username: 'Group', hex: '#25D366', followerCount, specialDetail };
        default: return null;
    }
};

const KICK_SOCIAL: SocialLink = {
    name: 'KICK',
    url: 'https://kick.com/iabs',
    icon: <KickIcon className="w-8 h-8" />,
    color: '',
    username: 'iABS',
    hex: '#53FC18',
    followerCount: '121.1K',
    specialDetail: 'البث الأساسي والتفاعل المباشر'
};

const EMAIL_ADDRESS = "";

// زر "موقع خاص بك" — يفتح موقع HSG
const OWN_SITE_URL = 'https://mohhsg.vercel.app/';
const OWN_SITE_ICON = 'mohhsg-icon.png';

const TRANSLATIONS = {
    en: {
        status: 'LIVE NOW', statusOffline: 'OFFLINE',
        headerTitle: 'iABS STREAM HUB',
        eyebrow: 'King of acceptance & consistency',
        nameAr: 'Mohammed Al-Qahtani',
        bio: 'Mohammed Al-Qahtani broadcasts here daily. Welcome! Follow the king of acceptance and perseverance for a better life.',
        tags: ['Gaming', 'Just Chatting', 'Live Daily'],
        defaultStreamTitle: 'CHECK OUT THE VODS | FOLLOW NOW',
        defaultCategory: 'Offline',
        footer: '© 2026 iABS. All Rights Reserved.',
        poweredBy: 'POWERED BY HSG',
        watchLive: 'Watch Live', joinDiscord: 'Join Discord',
        subOnly: 'SUB ONLY', dropsEnabled: 'DROPS ENABLED', noTags: 'No tags',
        shareTitle: 'iABS Stream Hub', shareText: 'Check out iABS live on Kick!', copied: 'Link copied!',
        contact: 'Contact & Business',
        lastSessionReport: 'Last session report', ago: 'Ago', duration: 'Duration',
        categoriesSpent: 'Categories in this stream', highlights: 'Stream highlights',
        socialsTitle: 'Social Arena', socialsSub: 'One hub — every platform. Pick your battlefield.',
        communityTitle: 'Community HQ', supportTitle: 'Support & Donation', supportSub: 'Your support keeps the stream legendary.',
        modsTitle: 'Moderators',
        tiersTitle: 'Special alert tiers', pollLive: 'LIVE POLL',
        theaterTitle: 'Live Theater', viewers: 'watching',
        statsKick: 'Kick followers', statsViews: 'Site visits', statsPlatforms: 'Platforms', statsStatus: 'Status',
        follow: 'Follow', open: 'Open', followers: 'followers',
        ownSite: 'Want a website of your own?',
        ownSiteBtn: 'Get your own site',
    },
    ar: {
        status: 'بث مباشر الآن', statusOffline: 'غير متصل حالياً',
        headerTitle: 'مركز iABS للبث المباشر',
        eyebrow: 'ملك القبول والاستمرارية لحياة أفضل',
        nameAr: 'محمد القحطاني',
        bio: 'محمد القحطاني يبث هنا يومياً — حياك الله. تابع ملك القبول والاستمرارية، واستمتع بأقوى بثوث الألعاب والسوالف والفعاليات مع مجتمع الأساطير.',
        tags: ['ألعاب', 'سوالف', 'بث يومي'],
        defaultStreamTitle: 'تابع البثوث السابقة | تابعني الآن',
        defaultCategory: 'غير متصل',
        footer: '© 2026 iABS. جميع الحقوق محفوظة.',
        poweredBy: 'بدعم من HSG',
        watchLive: 'شاهد البث', joinDiscord: 'انضم للديسكورد',
        subOnly: 'للمشتركين فقط', dropsEnabled: 'الجوائز مفعلة', noTags: 'لا يوجد وسوم',
        shareTitle: 'مركز بث iABS', shareText: 'تابع بث iABS المباشر على كيك!', copied: 'تم نسخ الرابط!',
        contact: 'للتواصل والإعلان',
        lastSessionReport: 'تقرير الجلسة الأخيرة', ago: 'منذ', duration: 'المدة',
        categoriesSpent: 'الفئات التي تم بثها', highlights: 'لقطات ممتعة من البث',
        socialsTitle: 'ساحة التواصل', socialsSub: 'كل المنصات في مكان واحد — اختر ساحتك.',
        communityTitle: 'مقر المجتمع', supportTitle: 'الدعم المادي', supportSub: 'دعمك يخلي البث أسطوري ويستمر.',
        modsTitle: 'المشرفون',
        tiersTitle: 'مستويات التنبيه الخاصة', pollLive: 'تصويت مباشر',
        theaterTitle: 'مسرح البث المباشر', viewers: 'مشاهد',
        statsKick: 'متابع كيك', statsViews: 'زيارة للموقع', statsPlatforms: 'منصة', statsStatus: 'الحالة',
        follow: 'تابع', open: 'افتح', followers: 'متابع',
        ownSite: 'تبي موقع خاص بك؟',
        ownSiteBtn: 'اطلب موقعك',
    }
};

// ================= DESIGN SYSTEM =================

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' }> = ({ children, delay = 0, className = '' }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
            el.classList.add('is-visible');
            return;
        }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); } });
        }, { threshold: 0, rootMargin: '0px 0px 100px 0px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
};

const ArenaBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        // الجسيمات أقل على الجوال + إطار أبطأ = بطارية وسرعة
        const MIN_DT = isMobile ? 50 : 33; // ~20fps جوال / ~30fps ديسكتوب
        const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);

        let raf = 0;
        let running = true;
        let scrolling = false;
        let scrollTimer = 0;
        let last = 0;
        let w = 0;
        let h = 0;

        type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; red: boolean };
        let parts: P[] = [];

        /* --- Glowing balls are pre-rendered once into a sprite ---
           (shadowBlur on every frame is one of the most expensive operations in canvas) */
        const makeSprite = (core: string, glow: string) => {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d')!;
            const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grd.addColorStop(0, core);
            grd.addColorStop(0.18, core);
            grd.addColorStop(0.42, glow);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, size, size);
            return c;
        };
        const spriteRed = makeSprite('rgba(255,90,90,0.95)', 'rgba(255,45,45,0.35)');
        const spriteWhite = makeSprite('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.12)');

        const resize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * DPR);
            canvas.height = Math.round(h * DPR);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            const n = Math.min(isMobile ? 30 : 52, Math.floor(w / 30));
            parts = Array.from({ length: n }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                r: 0.8 + Math.random() * 2.4,
                vy: -(0.15 + Math.random() * 0.55), vx: (Math.random() - 0.5) * 0.25,
                a: 0.18 + Math.random() * 0.55, red: Math.random() > 0.72,
            }));
        };

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            // يتوقف الرسم كلياً أثناء التمرير النشط — التمرير أولاً، والجسيمات بعده
            if (!running || scrolling) { last = now; return; }
            if (now - last < MIN_DT) return;
            last = now;

            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.y += p.vy;
                p.x += p.vx;
                if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
                if (p.x < -8) p.x = w + 8;
                if (p.x > w + 8) p.x = -8;

                const s = p.r * 10;
                ctx.globalAlpha = p.a;
                ctx.drawImage(p.red ? spriteRed : spriteWhite, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
        };

        /* --- Stop completely when the tab is hidden: saves battery + CPU --- */
        const onVisibility = () => {
            running = document.visibilityState === 'visible';
            last = 0;
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        const onScroll = () => {
            scrolling = true;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => { scrolling = false; last = 0; }, 220);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(scrollTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);
    return (
        <div className="fixed inset-0 z-0 bg-transparent overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 responsive_bg scale-105 opacity-100" />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 6% 8%,rgba(5,3,3,.62) 0%,rgba(5,3,3,.28) 24%,transparent 46%),radial-gradient(ellipse at 88% 82%,rgba(5,3,10,.94) 0%,rgba(5,3,8,.78) 24%,rgba(6,2,2,.48) 42%,transparent 64%),linear-gradient(rgba(6,2,2,.42),rgba(6,2,2,.74))' }} />
        </div>
    );
};
const SectionHeading: React.FC<{ no: string; title: string; sub?: string; en?: string }> = ({ no, title, sub, en }) => (
    <div className="flex items-end gap-3 md:gap-4 mb-6 md:mb-9">
        <span className="font-gaming text-3xl sm:text-4xl md:text-6xl leading-none text-stroke-red select-none shrink-0" dir="ltr">{no}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                {en && <span className="hidden sm:inline text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase" dir="ltr">{en}</span>}
            </div>
            {sub && <p className="text-[13px] md:text-sm text-white/50 mt-1 font-medium">{sub}</p>}
            <div className="mt-2.5 md:mt-3 h-px w-full bg-gradient-to-l from-[#FF2D2D]/60 via-white/10 to-transparent" />
        </div>
    </div>
);

// --- تحميل مؤجل: ما ينزّل كود القسم إلا لما الزائر يقرب منه ---
const DeferredMount: React.FC<{ children: React.ReactNode; rootMargin?: string; minHeight?: number }> = ({ children, rootMargin = '700px', minHeight = 220 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') { setShow(true); return; }
        const obs = new IntersectionObserver(
            (entries) => { if (entries.some(e => e.isIntersecting)) { setShow(true); obs.disconnect(); } },
            { rootMargin, threshold: 0 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [rootMargin]);
    return <div ref={ref} className="h-full" style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
};

// --- Count-up number (rAF, reduced-motion safe) ---
const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1300 }) => {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
        let raf = 0;
        const t0 = performance.now();
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);
    return <span dir="ltr">{n.toLocaleString('en-US')}</span>;
};

// --- Last Session Report: MISSION DEBRIEF edition (rich Kick data) ---
const LastSessionReport: React.FC<{ lang: Language; data: any; clips: any[]; past?: any[] }> = ({ lang, data, clips, past = [] }) => {
    if (!data) return null;
    const timeAgo = (date: string) => {
        if (!date) return '---';
        const now = new Date(); const pastD = new Date(date);
        if (isNaN(pastD.getTime())) return '---';
        const diff = Math.floor((now.getTime() - pastD.getTime()) / 1000);
        if (diff < 60) return lang === 'en' ? `${diff}s ago` : `منذ ${diff} ثانية`;
        if (diff < 3600) return lang === 'en' ? `${Math.floor(diff / 60)}m ago` : `منذ ${Math.floor(diff / 60)} دقيقة`;
        if (diff < 86400) return lang === 'en' ? `${Math.floor(diff / 3600)}h ago` : `منذ ${Math.floor(diff / 3600)} ساعة`;
        return lang === 'en' ? `${Math.floor(diff / 86400)}d ago` : `منذ ${Math.floor(diff / 86400)} يوم`;
    };
    const formatDuration = (val: number) => {
        if (!val) return '0h 0m';
        const totalSeconds = val > 1000000 ? Math.floor(val / 1000) : val;
        return `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`;
    };
    const t = TRANSLATIONS[lang] as any;
    const thumbnail = data.thumbnail?.url || data.thumbnail?.src || (typeof data.thumbnail === 'string' ? data.thumbnail : '') || (data.responsive_url) || PC_BACKGROUND;
    const views = Number(data.views ?? data.video?.views ?? 0);
    const peak = Number(data.viewer_count ?? 0);
    const durH = data.duration > 1000000 ? data.duration / 3600000 : (Number(data.duration) || 0) / 3600;
    const vph = durH > 0.05 ? Math.round(views / durH) : views;
    const vodUrl = `https://kick.com/${CHANNEL_SLUG}/videos/${data.id}`;
    const isSubOnly = data.video?.status === 'subscriber_only' || data.video?.is_private === true;
    const fullDate = (() => { try { return new Date(data.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } })();
    const sessions = [data, ...past].slice(0, 4);
    const maxV = Math.max(1, ...sessions.map((s: any) => Number(s.views ?? s.video?.views ?? 0)));
    const compact = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;
    const vodUrlOf = (v: any) => `https://kick.com/${CHANNEL_SLUG}/videos/${v.id}`;
    const catTags: string[] = [...new Set((data.categories || []).flatMap((c: any) => c.tags || []))].slice(0, 4) as string[];
    const L = {
        views: lang === 'en' ? 'VIEWS' : 'المشاهدات',
        peak: lang === 'en' ? 'PEAK' : 'الذروة',
        perHour: lang === 'en' ? 'VIEWS / HR' : 'مشاهدة / ساعة',
        pulse: lang === 'en' ? 'RECENT SESSIONS PULSE' : 'نبض الجلسات الأخيرة',
        watch: lang === 'en' ? 'WATCH VOD' : 'مشاهدة التسجيل',
        family: lang === 'en' ? 'FAMILY' : 'عائلي',
    };
    const stats = [
        { label: t.duration, value: <span dir="ltr">{formatDuration(data.duration)}</span>, hot: true, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { label: L.views, value: <CountUp value={views} />, hot: false, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
        { label: L.peak, value: <CountUp value={peak} />, hot: true, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 1015 12a3 3 0 00-2.88 3.12z" clipRule="evenodd" /></svg> },
        { label: L.perHour, value: <CountUp value={vph} />, hot: false, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> },
    ];
    return (
        <Reveal className="w-full">
            <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px] border border-white/10 bg-[#0a0a0a]/92 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                {/* cinematic ambient from thumbnail */}
                <img src={thumbnail} alt="" aria-hidden="true" className="hidden sm:block absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-110 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-[#FF2D2D] to-transparent" />
                <div className="relative p-5 sm:p-8 md:p-10">
                    {/* header */}
                    <div className="flex flex-wrap items-center gap-3 mb-6 md:mb-8 animate-fade-in-up">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF2D2D] shadow-[0_0_14px_#FF2D2D] animate-pulse shrink-0" />
                        <span className="text-[11px] font-black tracking-[0.35em] text-white/45 uppercase">{t.lastSessionReport}</span>
                        <span className="ms-auto flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {fullDate} • {timeAgo(data.created_at)}
                            </span>
                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border tracking-widest ${isSubOnly ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-[#53FC18]/10 border-[#53FC18]/40 text-[#53FC18]'}`}>
                                {isSubOnly ? t.subOnly : 'PUBLIC'}
                            </span>
                        </span>
                    </div>

                    {/* hero */}
                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-start">
                        <div className="[perspective:1200px] w-full lg:w-[380px] shrink-0 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                            <a href={vodUrl} target="_blank" rel="noopener noreferrer"
                                className="group relative block aspect-video rounded-2xl overflow-hidden border border-[#FF2D2D]/30 bg-black shadow-[0_24px_60px_-16px_rgba(255,45,45,0.4)] [transform:rotateY(-7deg)_rotateX(2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)] transition-transform duration-700">
                                <img src={thumbnail} alt="Last Session" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                <span className="absolute top-3 start-3 text-[10px] font-black px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-white/80 backdrop-blur">VOD</span>
                                <span className="absolute inset-0 m-auto w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#FF2D2D]/25 backdrop-blur-md border border-[#FF2D2D]/70 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-[0_0_36px_rgba(255,45,45,0.55)]">
                                    <svg className="w-6 h-6 text-white fill-current translate-x-[1px] rtl:-translate-x-[1px]" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                </span>
                                <span className="absolute bottom-3 end-3 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/75 border border-white/15 text-white" dir="ltr">{formatDuration(data.duration)}</span>
                                <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/75 border border-white/15 text-white" dir="ltr">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    {compact(views)}
                                </span>
                            </a>
                            <span className="mt-3 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#FF2D2D] text-black font-black text-sm shadow-[0_12px_30px_-10px_rgba(255,45,45,0.6)] active:scale-[0.98] transition-transform">
                                {L.watch}
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                        </div>

                        <div className="flex-1 min-w-0 w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-3 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-white/70" dir="ltr">{data.language || 'AR'}</span>
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-white/70">{data.is_mature ? '18+' : L.family}</span>
                                {catTags.map((tag, i) => <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FF2D2D]/10 border border-[#FF2D2D]/30 text-[#ff8080]" dir="ltr">#{tag}</span>)}
                            </div>
                            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-snug mb-5 animate-fade-in-up" style={{ animationDelay: '180ms' }}>{data.session_title || data.title}</h3>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
                                {stats.map((s, i) => (
                                    <div key={i} className={`card-sheen relative overflow-hidden rounded-2xl border px-4 py-4 text-center backdrop-blur-md animate-fade-in-up ${s.hot ? 'bg-[#FF2D2D]/[0.07] border-[#FF2D2D]/25' : 'bg-white/[0.04] border-white/10'}`} style={{ animationDelay: `${220 + i * 80}ms` }}>
                                        <span className={`mx-auto w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${s.hot ? 'bg-[#FF2D2D]/15 text-[#ff6b6b]' : 'bg-white/[0.07] text-white/60'}`}>{s.icon}</span>
                                        <p className="text-lg sm:text-xl md:text-2xl font-black text-white">{s.value}</p>
                                        <p className="text-[9px] sm:text-[10px] font-bold text-white/35 uppercase tracking-widest mt-1">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* recent sessions pulse */}
                            {sessions.length > 1 && (
                                <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '540ms' }}>
                                    <p className="text-[10px] font-black tracking-[0.25em] text-white/30 uppercase mb-3">{L.pulse}</p>
                                    <div className="flex items-end gap-2 sm:gap-3 h-28 sm:h-32" dir="ltr">
                                        {sessions.map((s: any, i: number) => {
                                            const v = Number(s.views ?? s.video?.views ?? 0);
                                            const h = Math.max(10, Math.round((v / maxV) * 100));
                                            const cur = i === 0;
                                            return (
                                                <a key={s.id || i} href={vodUrlOf(s)} target="_blank" rel="noopener noreferrer" title={s.session_title || s.title}
                                                    className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group/bar min-w-0">
                                                    <span className={`text-[10px] sm:text-[11px] font-black ${cur ? 'text-[#ff6b6b]' : 'text-white/45'}`} dir="ltr">{compact(v)}</span>
                                                    <span className="tier-bar w-full max-w-[90px] rounded-t-lg border-x border-t relative overflow-hidden"
                                                        style={{
                                                            height: `${h}%`, animationDelay: `${i * 120}ms`,
                                                            background: cur ? 'linear-gradient(to bottom, #FF2D2D, #FF2D2D55 60%, rgba(0,0,0,0.5))' : 'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.06))',
                                                            borderColor: cur ? '#FF2D2D88' : 'rgba(255,255,255,0.15)',
                                                            boxShadow: cur ? '0 0 22px -4px rgba(255,45,45,0.7)' : 'none',
                                                        }}>
                                                        <span className="absolute top-0 inset-x-2 h-1 rounded-full bg-white/40 blur-[1px]" />
                                                    </span>
                                                    <span className={`w-full max-w-[90px] h-1.5 rounded-b bg-black/70 border-x border-b ${cur ? 'border-[#FF2D2D]/50' : 'border-white/10'}`} />
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {data.categories?.length > 0 && (
                                <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '620ms' }}>
                                    <p className="text-[10px] font-black tracking-[0.25em] text-white/30 uppercase mb-3">{t.categoriesSpent}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {data.categories.map((cat: any, i: number) => {
                                            const catName = cat.name || cat.category?.name || 'Just Chatting';
                                            const slug = cat.slug || cat.category?.slug || catName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                                            const catImg = cat.banner?.url || cat.banner?.responsive || cat.category?.banner?.url || cat.category?.banner?.responsive || cat.responsive_url || cat.thumbnail?.url || cat.category?.responsive_url || cat.category?.thumbnail?.url || `https://files.kick.com/categories/${slug}/fullsize.png`;
                                            return (
                                                <span key={i} className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-full ps-1 pe-3 py-1 hover:border-[#FF2D2D]/40 transition-colors">
                                                    <span className="w-7 h-7 rounded-full overflow-hidden bg-black border border-white/10 block">
                                                        <img src={catImg} alt={catName} loading="lazy" className="w-full h-full object-cover"
                                                            onError={(e) => { const tg = e.target as HTMLImageElement; tg.src = tg.src.includes('picsum') ? DEFAULT_PROFILE_IMAGE : `https://picsum.photos/seed/${slug}/100/100`; }} />
                                                    </span>
                                                    <span className="text-[11px] font-bold text-white/75">{catName}</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {clips && clips.length > 0 && (
                        <div className="mt-8 md:mt-10 pt-7 border-t border-white/[0.07] animate-fade-in-up" style={{ animationDelay: '680ms' }}>
                            <div className="flex items-center gap-2.5 mb-5">
                                <span className="w-2 h-2 rounded-full bg-neon shadow-[0_0_10px_#53FC18]" />
                                <span className="text-[11px] font-black tracking-[0.25em] text-white/40 uppercase">{t.highlights}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                {clips.slice(0, 3).map((clip: any, i: number) => (
                                    <a key={clip.id || i} href={`https://kick.com/${CHANNEL_SLUG}?clip=${clip.id}`} target="_blank" rel="noopener noreferrer"
                                        className="group relative aspect-video rounded-xl md:rounded-2xl overflow-hidden border border-white/10 bg-black hover:border-[#53FC18]/60 hover:-translate-y-1 transition-all duration-300">
                                        <img src={clip.thumbnail_url || clip.thumbnail?.url || PC_BACKGROUND} alt={clip.title} loading="lazy"
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                                        <span className="absolute top-1.5 start-1.5 w-5 h-5 md:w-6 md:h-6 rounded-lg bg-black/70 border border-white/15 text-white/80 text-[9px] md:text-[10px] font-black flex items-center justify-center backdrop-blur" dir="ltr">{i + 1}</span>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-[#53FC18]/25 backdrop-blur border border-[#53FC18]/60 flex items-center justify-center">
                                                <svg className="w-4 h-4 md:w-5 md:h-5 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </span>
                                        </div>
                                        <div className="absolute bottom-0 inset-x-0 p-2 md:p-3">
                                            <p className="text-[8px] md:text-[11px] font-bold text-white truncate">{clip.title}</p>
                                            <p className="text-[7px] md:text-[10px] text-white/45 font-medium" dir="ltr">{clip.view_count || 0} {lang === 'en' ? 'views' : 'مشاهدة'}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Reveal>
    );
};

export default function App() {
    const [lang, setLang] = useState<Language>('ar');
    const [branding] = useState({ profileImage: DEFAULT_PROFILE_IMAGE, bannerImage: PC_BACKGROUND });

    const [socialStats, setSocialStats] = useState<Record<string, string>>({
        'KICK': '121.1K', 'Snapchat': '50K', 'Instagram': '21.3K', 'TikTok': '68.3K+',
        'X': '68.6K', 'WhatsApp': formatFollowerCount(FALLBACK.whatsapp), 'Discord': '10.5K', 'YouTube': '110.1K+'
    });

    // الأعداد الخام الحية لأقسام الساحة — تبدأ بآخر قيم موثوقة وتتحدث من الـ API كل مرة
    const [rawStats, setRawStats] = useState<ArenaStats>({
        kick: 121100, tiktok: FALLBACK.tiktok, twitter: FALLBACK.twitter,
        youtube: FALLBACK.youtube, instagram: FALLBACK.instagram,
        discord: 10500, whatsapp: FALLBACK.whatsapp,
    });

    const [socials, setSocials] = useState<SocialLink[]>([]);
    const [lastSession, setLastSession] = useState<any>(null);
    const [pastSessions, setPastSessions] = useState<any[]>([]);
    const [clips, setClips] = useState<any[]>([]);

    const [visitorCount, setVisitorCount] = useState(0);
    const [activePoll, setActivePoll] = useState<any>(null);

    const [sponsors, setSponsors] = useState<any[]>([]);
    const [clipsList, setClipsList] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isScheduleActive, setIsScheduleActive] = useState(true);
    const [faqs, setFaqs] = useState<any[]>([]);
    const [isFaqActive, setIsFaqActive] = useState(true);

    const fetchPublicData = async () => {
        try {
            await Promise.all([
                supabase.from('sponsors').select('*').order('id', { ascending: false })
                    .then(({ data }) => setSponsors(data || [])),
                supabase.from('highlight_clips').select('*').order('id', { ascending: false })
                    .then(({ data }) => setClipsList(data || [])),
                supabase.from('schedule').select('*').order('id', { ascending: true })
                    .then(({ data }) => setSchedule(data || [])),
                supabase.from('faqs').select('*').order('id', { ascending: false })
                    .then(({ data }) => setFaqs(data || [])),
                supabase.from('announcements').select('*').eq('id', 2).single()
                    .then(({ data }) => setIsScheduleActive(!data || data.is_active === true || data.is_active === 'true')),
                supabase.from('announcements').select('*').eq('id', 3).single()
                    .then(({ data }) => setIsFaqActive(!data || data.is_active === true || data.is_active === 'true')),
                supabase.from('seo_settings').select('*').eq('id', 1).single().then(({ data: seo }) => {
                    if (!seo) return;
                    document.title = seo.title || "iABS Stream Hub";
                    const setMeta = (name: string, content: string, isProperty = false) => {
                        if (!content) return;
                        const attr = isProperty ? 'property' : 'name';
                        let meta = document.querySelector(`meta[${attr}="${name}"]`);
                        if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attr, name); document.head.appendChild(meta); }
                        meta.setAttribute('content', content);
                    };
                    setMeta('description', seo.description);
                    setMeta('keywords', seo.keywords || 'iABS, Kick, Streamer');
                    setMeta('og:title', seo.title, true);
                    setMeta('og:description', seo.description, true);
                }),
            ]);
        } catch (e) { console.error("Public Data Fetch Exception:", e); }
    };

    useEffect(() => {
        let isTracked = false;
        const initData = async () => {
            if (!sessionStorage.getItem('site_visited') && !isTracked) {
                isTracked = true;
                sessionStorage.setItem('site_visited', 'true');
                const { data: overall } = await supabase.from('site_stats').select('visits').eq('id', 1).single();
                if (overall) {
                    const newVisits = overall.visits + 1;
                    await supabase.from('site_stats').update({ visits: newVisits }).eq('id', 1);
                    setVisitorCount(newVisits);
                }
                const today = new Date().toISOString().split('T')[0];
                const { data: todayStats } = await supabase.from('daily_views').select('*').eq('view_date', today).single();
                if (todayStats) await supabase.from('daily_views').update({ views_count: todayStats.views_count + 1 }).eq('id', todayStats.id);
                else await supabase.from('daily_views').insert([{ view_date: today, views_count: 1 }]);
            }
        };
        fetchPublicData();
        initData().catch(e => console.error('Visit Tracking Exception:', e));

        const fetchLive = async () => {
            const [statRes, pollRes] = await Promise.all([
                supabase.from('site_stats').select('visits').eq('id', 1).single(),
                supabase.from('polls').select('*').eq('is_active', true).order('id', { ascending: false }).limit(1).single(),
            ]);
            if (statRes.data) setVisitorCount(statRes.data.visits);
            setActivePoll(pollRes.data || null);
        };
        fetchLive();
        // يتوقف التحديث التلقائي والتبويب مخفي
        let interval: ReturnType<typeof setInterval> | null = null;
        const startLive = () => { if (!interval) interval = setInterval(fetchLive, 30000); };
        const stopLive = () => { if (interval) { clearInterval(interval); interval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchLive(); startLive(); } else stopLive(); };
        startLive();
        document.addEventListener('visibilitychange', onVis);
        return () => { stopLive(); document.removeEventListener('visibilitychange', onVis); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live social counters — dedicated 5-minute loop + instant cache paint (API-style)
    useEffect(() => {
        const apply = (stats: { instagram?: number; tiktok?: number; twitter?: number; youtube?: number; whatsapp?: number }) => {
            setSocialStats(prev => ({
                ...prev,
                'Instagram': formatFollowerCount(stats.instagram || 0),
                'TikTok': formatFollowerCount(stats.tiktok || 0),
                'X': formatFollowerCount(stats.twitter || 0),
                'YouTube': formatFollowerCount(stats.youtube || 0),
                'WhatsApp': formatFollowerCount(stats.whatsapp || FALLBACK.whatsapp),
            }));
            setRawStats(prev => ({
                ...prev,
                instagram: stats.instagram || prev.instagram,
                tiktok: stats.tiktok || prev.tiktok,
                twitter: stats.twitter || prev.twitter,
                youtube: stats.youtube || prev.youtube,
                whatsapp: stats.whatsapp || prev.whatsapp,
            }));
        };
        const cached = readSocialCache();
        if (cached) apply(cached);
        let dead = false;
        const refreshSocials = () => {
            getAllSocialMediaStats().then(stats => { if (!dead) apply(stats); }).catch(() => {});
        };
        refreshSocials();
        let socialInterval: ReturnType<typeof setInterval> | null = null;
        const startSocials = () => { if (!socialInterval) socialInterval = setInterval(refreshSocials, SOCIAL_TTL_MS); };
        const stopSocials = () => { if (socialInterval) { clearInterval(socialInterval); socialInterval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') startSocials(); else stopSocials(); };
        startSocials();
        document.addEventListener('visibilitychange', onVis);
        return () => { dead = true; stopSocials(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

    const handleVote = async (optionId: number) => {
        if (!activePoll || localStorage.getItem(`voted_${activePoll.id}`)) return;
        const newOptions = activePoll.options.map((opt: any) => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt);
        await supabase.from('polls').update({ options: newOptions }).eq('id', activePoll.id);
        setActivePoll({ ...activePoll, options: newOptions });
        localStorage.setItem(`voted_${activePoll.id}`, 'true');
    };

    useEffect(() => {
        const updated = [
            { ...KICK_SOCIAL, followerCount: socialStats['KICK'] },
            createSocialLink('snapchat', 'https://www.snapchat.com/@iabsq', socialStats['Snapchat'], 'يوميات حصرية وتغطيات خاصة'),
            createSocialLink('instagram', 'https://www.instagram.com/absq/', socialStats['Instagram'], 'صور وكواليس حصرية'),
            createSocialLink('tiktok', 'https://www.tiktok.com/@iabsq', socialStats['TikTok'], 'أقوى المقاطع والتحديات'),
            createSocialLink('twitter', 'https://x.com/iABSq', socialStats['X'], 'أخبار وتحديثات سريعة'),
            createSocialLink('whatsapp', 'https://www.whatsapp.com/channel/0029VadbqYx5Ui2eInkr7v2E', socialStats['WhatsApp'], 'تواصل مباشر وتنبيهات البث'),
            createSocialLink('discord', 'https://discord.com/invite/64aggJ9yRA', socialStats['Discord'], 'أكبر تجمع للأساطير'),
            createSocialLink('youtube', 'https://www.youtube.com/channel/UCdIM7MB-8G-FgE7ld3XAQ8w', socialStats['YouTube'], 'أرشيف البثوث ومقاطع مميزة'),
        ].filter(Boolean) as SocialLink[];
        setSocials(updated);
    }, [socialStats]);

    // عدد أعضاء الديسكورد الحقيقي — invite API (يتحدث كل 5 دقائق، يتوقف والتبويب مخفي)
    useEffect(() => {
        let dead = false;
        const loadMembers = async () => {
            try {
                const r = await fetch('https://discord.com/api/v9/invites/64aggJ9yRA?with_counts=true');
                const j = await r.json();
                const n = j?.approximate_member_count;
                if (!dead && typeof n === 'number' && n > 0) setRawStats(prev => ({ ...prev, discord: n }));
            } catch { /* keep last */ }
        };
        loadMembers();
        let iv: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!iv) iv = setInterval(loadMembers, SOCIAL_TTL_MS); };
        const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { loadMembers(); start(); } else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { dead = true; stop(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

    const [streamInfo, setStreamInfo] = useState({ isLive: false, viewers: 0, title: '', category: '', tags: [] as string[] });
    const t = TRANSLATIONS[lang];

    const fetchKickStatus = useCallback(async () => {
        try {
            // الثلاث طلبات مع بعض بدل ما تكون متتابعة
            const [channelData, videosRawData, clipsRawData] = await Promise.all([
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/videos`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/clips?limit=5`, true),
            ]);

            const data = channelData;
            if (data) {
                const livestreamData = data.livestream || data.live_stream;
                const isLive = livestreamData && (livestreamData.is_live === true || livestreamData.is_live === 1);
                if (isLive) {
                    setStreamInfo({
                        isLive: true,
                        viewers: livestreamData.viewer_count || 0,
                        title: livestreamData.session_title || livestreamData.title || 'Live Stream',
                        category: livestreamData.categories?.[0]?.name || 'Just Chatting',
                        tags: livestreamData.tags ? livestreamData.tags.map((tg: any) => tg.name || tg) : []
                    });
                } else setStreamInfo(prev => ({ ...prev, isLive: false }));
                if (data.followers_count !== undefined) {
                    // Kick يرجّع العدد نصاً أحياناً — نحوّله لرقم دائماً
                    const count = Number(data.followers_count);
                    if (Number.isFinite(count) && count > 0) {
                        setSocialStats(prev => ({ ...prev, 'KICK': count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString() }));
                        setRawStats(prev => ({ ...prev, kick: count }));
                    }
                }
            }

            const videosArray = videosRawData?.videos || (Array.isArray(videosRawData) ? videosRawData : []);
            if (videosArray?.length > 0) { setLastSession(videosArray[0]); setPastSessions(videosArray.slice(1, 4)); }
            else {
                const streams = data?.previous_livestreams || data?.recent_streams || [];
                if (streams?.length > 0) { setLastSession(streams[0]); setPastSessions(streams.slice(1, 4)); }
            }

            const clipsData = clipsRawData?.data || clipsRawData;
            const clipsArray = clipsData?.clips || (Array.isArray(clipsData) ? clipsData : (clipsData?.data && Array.isArray(clipsData.data) ? clipsData.data : []));
            setClips(Array.isArray(clipsArray) ? clipsArray.slice(0, 3) : []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchKickStatus();
        // ما نسأل السيرفر والتبويب مخفي — يوفّر باقة الداتا والبطارية
        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!timer) timer = setInterval(fetchKickStatus, 60000); };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchKickStatus(); start(); } else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
    }, [fetchKickStatus]);

    const handleShare = async () => {
        const shareUrl = "https://kick.com/iabs";
        if (navigator.share) { try { await navigator.share({ title: t.shareTitle, text: t.shareText, url: shareUrl }); } catch { /* dismissed */ } }
        else { try { await navigator.clipboard.writeText(shareUrl); } catch { /* clipboard blocked */ } alert(t.copied); }
    };

    const displayTitle = streamInfo.isLive ? streamInfo.title : t.defaultStreamTitle;
    const displayCategory = streamInfo.isLive ? streamInfo.category : t.defaultCategory;

    /* Archive nav: the 60-day wall mounts lazily, so wait for #archive60 to exist. */
    const handleArchiveNav = useCallback(() => {
        const jump = () => document.querySelector('#archive60')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (document.querySelector('#archive60')) { jump(); return; }
        document.querySelector('#stats-area')?.scrollIntoView({ block: 'start' });
        let tries = 0;
        const iv = window.setInterval(() => {
            if (document.querySelector('#archive60')) { window.clearInterval(iv); jump(); }
            else if (++tries > 24) window.clearInterval(iv);
        }, 150);
    }, []);

    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }, [lang]);

    // Recover scrolling after a modal is closed or after a Vite HMR refresh.
    // Some browsers keep the previous inline body lock when the modal component
    // is replaced during development, which makes the whole page appear frozen.
    useEffect(() => {
        const restoreScroll = () => {
            const overlays = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], .cl-modal, .shx .ov, .absa .ov, .absr .ov, .absr .pov'));
            const modalOpen = overlays.some((el) => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
            });
            if (!modalOpen) {
                document.body.style.overflow = '';
                document.body.style.overflowY = 'auto';
                document.documentElement.style.overflowY = 'auto';
            }
        };
        restoreScroll();
        window.addEventListener('pageshow', restoreScroll);
        window.addEventListener('focus', restoreScroll);
        return () => {
            window.removeEventListener('pageshow', restoreScroll);
            window.removeEventListener('focus', restoreScroll);
        };
    }, []);

    return (
        <div id="home" className={`grain relative min-h-screen w-full overflow-x-hidden ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
            <>
                    <AbsHeader
                        lang={lang}
                        onToggleLang={() => setLang(p => p === 'en' ? 'ar' : 'en')}
                    />
                    <HomeHero
                        lang={lang}
                        isLive={streamInfo.isLive}
                        followers={rawStats.kick}
                        visits={visitorCount}
                        platforms={socials.length || 8}
                        logo={branding.profileImage}
                        socials={socials}
                        onToggleLang={() => setLang(p => p === 'en' ? 'ar' : 'en')}
                        onRefresh={fetchKickStatus}
                        onArchive={handleArchiveNav}
                    />

                    <div className="relative z-10 w-full max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8 pb-10 overflow-clip">

                        {/* ===== SOCIALS — ABS ARENA (live counts) ===== */}
                        <section id="socials" className="pt-12 md:pt-16 scroll-mt-28">
                            <Suspense fallback={<div className="min-h-[220px]" />}>
                                <DeferredMount minHeight={220}>
                                    <SocialArena lang={lang} stats={rawStats} live={streamInfo} />
                                </DeferredMount>
                            </Suspense>
                        </section>

                        {/* ===== LIVE THEATER — CINEMA EDITION ===== */}
                        {streamInfo.isLive && (
                            <section id="live" className="relative pt-12 md:pt-16 scroll-mt-28 animate-slide-down">
                                {/* ambient stage glow (تدرّج شعاعي بدون فلتر) */}
                                <div className="pointer-events-none absolute -top-10 right-[10%] w-[420px] h-[220px] rounded-full"
                                    style={{ background: 'radial-gradient(ellipse, rgba(255,45,45,0.16) 0%, transparent 68%)' }} />
                                <div className="pointer-events-none absolute bottom-0 left-[5%] w-[300px] h-[180px] rounded-full"
                                    style={{ background: 'radial-gradient(ellipse, rgba(83,252,24,0.06) 0%, transparent 68%)' }} />
                                <Reveal><SectionHeading no="02" title={t.theaterTitle} sub={`${streamInfo.viewers.toLocaleString()} ${t.viewers}`} en="LIVE THEATER" /></Reveal>
                                <div className="relative rounded-[30px] p-[1.5px] bg-gradient-to-b from-[#FF2D2D]/70 via-[#FF2D2D]/15 to-white/10 shadow-[0_30px_90px_rgba(255,45,45,0.22)]">
                                    <div className="absolute -inset-3 rounded-[36px] pointer-events-none"
                                        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,45,45,0.14) 0%, transparent 70%)' }} />
                                    <div className="relative rounded-[29px] bg-[#0a0a0c]/95 overflow-hidden">
                                        {/* theater top strip */}
                                        <div className="flex items-center gap-2.5 px-4 md:px-5 py-3 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-[#FF2D2D] text-black tracking-[0.18em] shadow-[0_0_18px_rgba(255,45,45,0.6)]">
                                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />LIVE
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-white/75" dir="ltr">
                                                <svg className="w-3.5 h-3.5 text-[#53FC18]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                {streamInfo.viewers.toLocaleString()}
                                            </span>
                                            <span className="hidden sm:inline text-[11px] font-bold text-white/40 truncate flex-1">{displayCategory}</span>
                                            <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer"
                                                className="ms-auto inline-flex items-center gap-1.5 text-[11px] font-black px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 hover:text-white hover:border-[#53FC18]/50 hover:bg-[#53FC18]/10 transition-all shrink-0">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                Kick
                                            </a>
                                        </div>
                                        <div className="flex flex-col xl:flex-row xl:h-[640px]">
                                            <div className="flex-1 min-w-0 min-h-0 p-3 md:p-4 flex flex-col">
                                                <div className="relative rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shrink-0">
                                                    <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                                                        <StreamPlayer lang={lang} isLive={streamInfo.isLive} viewers={streamInfo.viewers} channelSlug={CHANNEL_SLUG} poster={branding.bannerImage} />
                                                    </div>
                                                    {/* floating LIVE chip over video */}
                                                    <div className="absolute top-4 start-4 flex items-center gap-2 pointer-events-none">
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur border border-[#FF2D2D]/50 text-[#ff8080] tracking-widest">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D2D] animate-pulse shadow-[0_0_8px_#FF2D2D]" />{t.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-4 md:px-2 md:py-4 flex flex-col gap-3 flex-1 min-h-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-lg md:text-2xl font-black text-white leading-tight" title={displayTitle}>{displayTitle}</h3>
                                                            <p className="text-sm text-white/50 font-bold mt-1.5 flex items-center gap-1.5"><span className="text-[#FF2D2D]">i</span><span className="text-white">ABS</span> <span className="text-white/25 mx-1">•</span> {displayCategory}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer"
                                                                className="btn-arena hidden sm:inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#FF2D2D] text-black text-[13px] font-black shadow-[0_0_28px_rgba(255,45,45,0.45)]">
                                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                {t.watchLive}
                                                            </a>
                                                            <button onClick={handleShare} aria-label="Share"
                                                                className="btn-arena w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:border-white/25 flex items-center justify-center shrink-0">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.07]">
                                                        <span className="px-2.5 py-1 rounded-lg bg-[#53FC18]/10 border border-[#53FC18]/30 text-[#53FC18] text-[10px] font-black uppercase tracking-wider animate-tick">{t.dropsEnabled}</span>
                                                        {streamInfo.tags.length > 0
                                                            ? streamInfo.tags.map((tag, i) => <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.06] text-white/55 text-[11px] font-bold hover:border-[#FF2D2D]/40 hover:text-white/80 transition-colors">#{tag}</span>)
                                                            : <span className="text-white/30 text-xs italic">{t.noTags}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-full xl:w-[370px] shrink-0 p-3 md:p-4 xl:ps-0 flex flex-col min-h-0 xl:h-full">
                                                <div className="h-[480px] md:h-[540px] xl:h-full xl:flex-1 xl:min-h-0 shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-[#0b0d0f] shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col min-h-0">
                                                    <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/[0.02]" />}>
                                                        <ChatWidget lang={lang} isDemo={false} />
                                                    </Suspense>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ===== COMMUNITY — ABS HQ (live Discord + YouTube) ===== */}
                        <section className="pt-12 md:pt-16">
                            <Suspense fallback={<div className="min-h-[420px]" />}>
                                <DeferredMount minHeight={420}>
                                    <CommunityHQ lang={lang} stats={rawStats} no={streamInfo.isLive ? '03' : '02'} />
                                </DeferredMount>
                            </Suspense>
                        </section>

                        {/* ===== SUPPORT — ABS Support v2 (live Streamlabs + Creators) ===== */}
                        <section id="support" className="pt-12 md:pt-16 scroll-mt-28">
                            <Suspense fallback={<div className="w-full h-72 rounded-[26px] border border-white/10 bg-white/[0.02] animate-pulse" />}>
                                <DeferredMount minHeight={420}>
                                    <SupportSection lang={lang} no={streamInfo.isLive ? '04' : '03'} />
                                </DeferredMount>
                            </Suspense>
                        </section>

                        {/* ===== MODERATORS ===== */}
                        <section id="moderators" className="scroll-mt-28">
                            <Suspense fallback={<div className="mods-page"><div className="mods-wrap"><div className="mods-loading" /></div></div>}>
                                <DeferredMount minHeight={280}>
                                    <ModeratorsSection lang={lang} />
                                </DeferredMount>
                            </Suspense>
                        </section>

                        {/* ===== POLL ===== */}
                        {activePoll && (
                            <section className="pt-12 md:pt-16">
                                <Reveal>
                                    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a]/92 p-6 md:p-9 shadow-2xl">
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-[#FF2D2D] to-transparent" />
                                        <div className="flex items-center justify-center gap-3 mb-7">
                                            <span className="w-2 h-2 rounded-full bg-[#FF2D2D] shadow-[0_0_10px_#FF2D2D] animate-pulse" />
                                            <h3 className="text-lg md:text-2xl font-black text-white text-center">{activePoll.question}</h3>
                                            <span className="w-2 h-2 rounded-full bg-[#FF2D2D] shadow-[0_0_10px_#FF2D2D] animate-pulse" />
                                        </div>
                                        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                                            {activePoll.options.map((opt: any) => {
                                                const total = activePoll.options.reduce((s: number, o: any) => s + o.votes, 0);
                                                const pct = total === 0 ? 0 : Math.round((opt.votes / total) * 100);
                                                const voted = !!localStorage.getItem(`voted_${activePoll.id}`);
                                                return (
                                                    <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={voted}
                                                        className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 text-start ${voted ? 'border-white/[0.07] bg-white/[0.03] cursor-default' : 'border-white/10 bg-black/40 hover:border-[#FF2D2D]/50 hover:-translate-y-0.5'}`}>
                                                        {voted && <span className="absolute top-0 bottom-0 end-0 bg-gradient-to-l from-[#FF2D2D]/25 to-transparent transition-all duration-1000" style={{ width: `${pct}%` }} />}
                                                        <span className="relative z-10 flex justify-between items-center gap-3">
                                                            <span className="font-black text-white">{opt.text}</span>
                                                            {voted && <span className="text-sm font-black text-white/60" dir="ltr">{pct}% ({opt.votes})</span>}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-center text-[10px] text-white/30 mt-6 font-black tracking-[0.3em] uppercase">{t.pollLive}</p>
                                    </div>
                                </Reveal>
                            </section>
                        )}

                        {/* ===== LAST SESSION ===== */}
                        {!streamInfo.isLive && (
                            <section className="pt-12 md:pt-16">
                                <Suspense fallback={<div className="min-h-[420px]" />}>
                                    <DeferredMount minHeight={420}>
                                        <SessionReport lang={lang} />
                                    </DeferredMount>
                                </Suspense>
                            </section>
                        )}

                        {/* ===== DYNAMIC: SPONSORS + CLIPS ===== */}
                        <section className="pt-12 md:pt-16">
                            <Suspense fallback={<div className="min-h-[320px]" />}>
                                <DeferredMount minHeight={320}>
                                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                                        <Reveal><SponsorsSection sponsors={sponsors} /></Reveal>
                                        <Reveal delay={100}><ClipsSection clips={clipsList} /></Reveal>
                                    </div>
                                </DeferredMount>
                            </Suspense>
                        </section>

                        <div id="schedule" className="pt-4 scroll-mt-28">
                            {(isScheduleActive || isFaqActive) && <Suspense fallback={<div className="min-h-[220px]" />}>
                                <DeferredMount minHeight={220}>
                                    {isScheduleActive && <Reveal><ScheduleSection schedule={schedule} /></Reveal>}
                                    {isFaqActive && <Reveal><FAQSection faqs={faqs} /></Reveal>}
                                </DeferredMount>
                            </Suspense>}
                        </div>

                        <section id="stats-area" className="pt-12 md:pt-16 scroll-mt-28">
                            <Reveal><Suspense fallback={<div className="w-full h-40 rounded-[26px] border border-white/10 bg-white/[0.02] animate-pulse" />}>
                                <DeferredMount minHeight={180}>
                                    <StatsSection lang={lang} />
                                </DeferredMount>
                            </Suspense></Reveal>
                        </section>

                        {/* ===== FOOTER ===== */}
                        <footer className="mt-16 md:mt-24 rounded-[28px] border border-white/10 bg-black/85 overflow-hidden relative">
                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#FF2D2D]/70 to-transparent" />
                            <div className="p-8 md:p-12 text-center relative">
                                <p className="font-gaming text-[18vw] md:text-[120px] leading-none text-stroke opacity-40 select-none" dir="ltr" aria-hidden="true">iABS</p>
                                <div className="flex flex-wrap justify-center gap-2.5 -mt-4 md:-mt-8 relative">
                                    {socials.slice(0, 6).map(s => (
                                        <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name}
                                            className="btn-arena w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-[#FF2D2D]/50">
                                            <span className="scale-[0.8] block">{s.icon}</span>
                                        </a>
                                    ))}
                                </div>
                                {EMAIL_ADDRESS && (
                                    <a href={`mailto:${EMAIL_ADDRESS}`} className="inline-flex items-center gap-2 mt-6 text-white/40 hover:text-white text-xs font-bold transition-colors">
                                        <MailIcon className="w-4 h-4" /> {t.contact}: {EMAIL_ADDRESS}
                                    </a>
                                )}
                                <p className="text-[11px] font-black tracking-[0.3em] text-white/50 mt-6 uppercase">{t.poweredBy}</p>
                                <a href={OWN_SITE_URL} target="_blank" rel="noopener noreferrer"
                                    className="group mt-4 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] sm:text-xs font-black text-white/70 transition-all duration-300 hover:text-white hover:border-white/25 hover:bg-white/[0.08] hover:shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
                                    <img src={OWN_SITE_ICON} alt="" aria-hidden="true" loading="lazy" className="w-6 h-6 rounded-[8px] object-cover ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.55)]" />
                                    <span className="tracking-wide">{t.ownSite}</span>
                                    <span className="text-white/30 group-hover:text-white/55 transition-colors">· {t.ownSiteBtn}</span>
                                </a>
                                <p className="text-[11px] text-white/35 mt-1">{t.footer}</p>
                            </div>
                        </footer>
                    </div>

            </>
        </div>
    );
}
