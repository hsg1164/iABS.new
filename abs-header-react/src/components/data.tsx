import type { ReactNode } from "react";

export type Lang = "ar" | "en";
export type I18nKey = "hub" | "off" | "arch2";

const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export interface NavItem { id: string; ar: string; en: string; icon: ReactNode }

export const NAV: NavItem[] = [
  { id: "socials", ar: "التواصل", en: "Social", icon: (
    <svg viewBox="0 0 24 24" {...p}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></svg>) },
  { id: "live", ar: "البث", en: "Stream", icon: (
    <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="12" rx="3" /><path d="m10.5 8.5 4 2.5-4 2.5zM8 21h8" /></svg>) },
  { id: "support", ar: "الدعم", en: "Support", icon: (
    <svg viewBox="0 0 24 24" {...p}><path d="M12 20s-7-4.5-9-9.2C1.8 7 4.2 4 7.3 4c1.9 0 3.5 1 4.7 2.8C13.2 5 14.8 4 16.7 4 19.8 4 22.2 7 21 10.8 19 15.5 12 20 12 20z" /></svg>) },
  { id: "schedule", ar: "الجدول", en: "Schedule", icon: (
    <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M12 14v3l2 1" /></svg>) },
  { id: "stats-area", ar: "الأرشيف", en: "Archive", icon: (
    <svg viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></svg>) },
];

export const I18N: Record<Lang, Record<I18nKey, string>> = {
  ar: { hub: "مركز بث iABS", off: "غير متصل حاليا", arch2: "أرشيف" },
  en: { hub: "iABS stream hub", off: "Offline", arch2: "Archive" },
};
