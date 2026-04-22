import { useEffect, useMemo, useState } from 'react';
import { Award, Clock, Crown, Facebook, Music2, Trophy, Video } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { LeaderboardEntry } from '../types';

type LeaderboardKey = 'views' | 'likesFb' | 'likesTt' | 'hours';

type LeaderboardSection = {
  key: LeaderboardKey;
  metric: 'views' | 'likes-fb' | 'likes-tt' | 'hours';
  title: string;
  subtitle: string;
  suffix: string;
  icon: typeof Video;
};

const sections: LeaderboardSection[] = [
  {
    key: 'views',
    metric: 'views',
    title: 'ยอดวิวรวม',
    subtitle: 'Facebook + TikTok ต่อ creator',
    suffix: 'views',
    icon: Video,
  },
  {
    key: 'likesFb',
    metric: 'likes-fb',
    title: 'ไลค์ Facebook',
    subtitle: 'ยอดไลค์จากโพสต์ Facebook',
    suffix: 'likes',
    icon: Facebook,
  },
  {
    key: 'likesTt',
    metric: 'likes-tt',
    title: 'ไลค์ TikTok',
    subtitle: 'ยอดไลค์จากโพสต์ TikTok',
    suffix: 'likes',
    icon: Music2,
  },
  {
    key: 'hours',
    metric: 'hours',
    title: 'ชั่วโมงทำงาน',
    subtitle: 'รวมชั่วโมงจาก time entries',
    suffix: 'hrs',
    icon: Clock,
  },
];

const emptyBoards: Record<LeaderboardKey, LeaderboardEntry[]> = {
  views: [],
  likesFb: [],
  likesTt: [],
  hours: [],
};

function formatValue(value: number, suffix: string) {
  const rounded = suffix === 'hrs' ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded.toLocaleString()} ${suffix}`;
}

export function AdminStats() {
  const [leaderboards, setLeaderboards] = useState(emptyBoards);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    Promise.all(sections.map((section) => dataService.fetchLeaderboard(section.metric)))
      .then(([views, likesFb, likesTt, hours]) => {
        if (!alive) return;
        setLeaderboards({ views, likesFb, likesTt, hours });
      })
      .catch((err) => {
        console.error('Failed to load leaderboard stats:', err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const topCreator = useMemo(() => {
    return leaderboards.views[0] || leaderboards.likesFb[0] || leaderboards.likesTt[0] || leaderboards.hours[0];
  }, [leaderboards]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Leaderboard</p>
          <h2 className="mt-1 text-2xl font-serif italic font-bold gold-text-gradient">สถิตินักปั้น</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            หน้านี้ใช้ข้อมูลชุดเดียวกับ leaderboard จาก API ใหม่ แยกอันดับตามยอดวิว, ไลค์ Facebook, ไลค์ TikTok และชั่วโมงทำงาน
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-400">
          <Award className="h-4 w-4 text-gold" />
          <span>{loading ? 'กำลังโหลดอันดับ...' : 'อัปเดตจากฐานข้อมูล'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_2fr]">
        <div className="glass-card gold-border-glow rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold text-black">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Top Creator</p>
              <h3 className="text-xl font-bold text-zinc-100">{topCreator?.name || topCreator?.creator || 'ยังไม่มีข้อมูล'}</h3>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {sections.map(({ key, title, suffix }) => {
              const row = leaderboards[key][0];
              return (
                <div key={key} className="rounded-2xl border border-zinc-900 bg-zinc-950/50 p-4">
                  <p className="text-[10px] text-zinc-500">{title}</p>
                  <p className="mt-1 text-lg font-bold text-gold">{row ? formatValue(row.value, suffix) : '-'}</p>
                  <p className="mt-1 truncate text-[10px] text-zinc-600">{row?.name || row?.creator || 'ไม่มีอันดับ'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sections.map(({ key, title, subtitle, suffix, icon: Icon }) => {
            const rows = leaderboards[key].slice(0, 10);
            return (
              <div key={key} className="rounded-3xl border border-zinc-900 bg-zinc-950/40 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gold" />
                      <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">{subtitle}</p>
                  </div>
                  <Trophy className="h-4 w-4 text-gold/40" />
                </div>

                <div className="space-y-2">
                  {rows.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 p-5 text-center text-xs text-zinc-600">
                      {loading ? 'กำลังโหลด...' : 'ยังไม่มีข้อมูลอันดับ'}
                    </div>
                  )}
                  {rows.map((entry) => (
                    <div key={`${key}-${entry.rank}-${entry.creator}`} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border border-zinc-900 bg-black/20 px-3 py-2.5">
                      <span className={`text-center font-mono text-sm font-bold ${entry.rank <= 3 ? 'text-gold' : 'text-zinc-600'}`}>
                        #{entry.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-200">{entry.name || entry.creator}</p>
                        <p className="truncate text-[10px] text-zinc-600">{entry.creator}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-gold">{formatValue(entry.value, suffix)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
