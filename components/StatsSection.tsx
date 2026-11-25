import React, { useEffect, useState } from 'react';
import { Language, LeaderboardData, ChannelInfo } from '../types';
import { ChatLegends } from './ChatLegends';
import Archive60 from './Archive60';
import ArchiveSection from './ArchiveSection';
import { SupportersHall } from './SupportersHall';
import { kickFetch } from '../utils/kickApi';

interface StatsSectionProps {
  lang: Language;
}

// Skeleton Primitive
const Skeleton: React.FC<{ className: string }> = ({ className }) => (
  <div className={`bg-white/5 animate-pulse rounded-xl ${className}`}></div>
);

export const StatsSection: React.FC<StatsSectionProps> = ({ lang }) => {
  // Initialize as null to indicate "loading"
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);

  useEffect(() => {
    const channelSlug = 'iabs';

    const endpoints = {
      leaderboard: `https://kick.com/api/v2/channels/${channelSlug}/leaderboards`,
      channel: `https://kick.com/api/v2/channels/${channelSlug}`
    };

    // جلب معلومات القناة (المتابعين)
    kickFetch(endpoints.channel).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف إن وجد
        setChannelInfo({
            followers_count: data?.followers_count || 0,
            subscriber_badges: data?.subscriber_badges || []
        });
    }).catch(() => setChannelInfo({ followers_count: 0, subscriber_badges: [] }));

    // جلب الداعمين
    kickFetch(endpoints.leaderboard).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف
        setLeaderboards({
            gifts: data?.gifts || [],
            gifts_week: data?.gifts_week || [],
            gifts_month: data?.gifts_month || []
        });
    }).catch(() => setLeaderboards({ gifts: [], gifts_week: [], gifts_month: [] }));

  }, []);

  return (
    <>
      <div className="w-full space-y-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

        {/* --- SUPPORTERS HALL: المتابعون + رتب المشتركين + كبار الداعمين --- */}
        {channelInfo && leaderboards ? (
          <SupportersHall lang={lang} channelInfo={channelInfo} leaderboards={leaderboards} />
        ) : (
          <div className="space-y-8">
            <Skeleton className="h-72 w-full rounded-[30px]" />
            <Skeleton className="h-96 w-full rounded-[30px]" />
          </div>
        )}

        {/* --- CHAT LEGENDS (أساطير الشات — قائمة التفاعل فقط) --- */}
        <div className="pt-8 border-t border-white/5">
          <ChatLegends />
        </div>

        {/* --- أرشيف جدار الـ60 (قبل آخر اللقطات) --- */}
        <div className="pt-8 border-t border-white/5">
          <Archive60 lang={lang} />
        </div>

        {/* --- ARCHIVE: آخر اللقطات والفيديوهات (abs-archive v4 — بيانات حقيقية + مشغّل HLS) --- */}
        <div
          className="pt-4 border-t border-white/5"
          style={{ marginTop: '1.5rem' }}
        >
          <ArchiveSection lang={lang} />
        </div>
      </div>
    </>
  );
};
