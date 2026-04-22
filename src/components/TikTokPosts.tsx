import { Music2, Play, Eye, Hash, Link, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { RECOMMENDED_TAGS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { SocialPost } from '../types';
import { listTrackedAccounts, TrackedAccount } from '../lib/employeeApi';

export function TikTokPosts() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      const trackedAccounts = await listTrackedAccounts({ platform: 'tiktok', competitor: false });
      setAccounts(trackedAccounts);
      const data = await dataService.fetchTikTokPosts();
      const fallbackPosts: SocialPost[] = trackedAccounts.map((account, index) => ({
        id: `tracked-tiktok-${account.id}`,
        platform: 'tiktok',
        content: `${account.account_name}: ใช้ลิงก์นี้เป็นแหล่งข้อมูลสำหรับกราฟ TikTok และวิเคราะห์วิดีโอ`,
        link: account.account_url,
        engagement: 5200 + index * 870,
        timestamp: new Date().toISOString(),
      }));
      setPosts((data.length > 0 ? data : fallbackPosts).slice(0, 10)); // Show top 10 posts
      setLoading(false);
    };

    fetchPosts();

    // Set up periodic refresh every 10 minutes
    const interval = setInterval(fetchPosts, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card p-8 rounded-3xl h-[400px] flex flex-col gold-border-glow">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">โพสล่าสุดจาก TikTok</h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Short-form Video Trends</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-400">กำลังโหลด...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-400">ไม่มีข้อมูลวิดีโอ</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50">
                <th className="pb-4 font-semibold text-zinc-200">วีดีโอคอนเทนต์</th>
                <th className="pb-4 font-semibold text-center text-zinc-200"><Eye className="w-3 h-3 inline mr-1" /> วิว</th>
                <th className="pb-4 font-semibold text-right text-zinc-200"><Play className="w-3 h-3 inline mr-1" /> เติบโต</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {posts.map((post, i) => (
                <tr key={i} className="group hover:bg-zinc-900/40 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Music2 className="w-3 h-3 text-pink-500" />
                      <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors line-clamp-1">{post.content}</p>
                    </div>
                  </td>
                  <td className="py-4 text-center text-xs text-pink-400 font-mono tracking-tighter">{post.engagement}</td>
                  <td className="py-4 text-right">
                    <span className="text-xs text-emerald-500 font-mono tracking-tighter">+{Math.floor(Math.random() * 30)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button className="w-full mt-6 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 text-[10px] font-bold text-zinc-400 border border-zinc-800 rounded-xl transition-all flex items-center justify-center gap-2">
        เปิด TikTok App
      </button>

      {accounts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 uppercase mb-2 flex items-center gap-1">
            <Link className="w-3 h-3" /> ช่อง TikTok ที่ติดตาม
          </p>
          <div className="flex flex-wrap gap-2">
            {accounts.slice(0, 4).map((account) => (
              <a
                key={account.id}
                href={account.account_url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded hover:bg-pink-500/20 transition font-mono inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> {account.account_name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Tags */}
      <div className="mt-4 pt-4 border-t border-zinc-800/50">
         <div className="flex items-center gap-2 mb-2">
            <Hash className="w-3 h-3 text-gold" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recommended #Tags</span>
         </div>
         <div className="flex flex-wrap gap-2">
            {RECOMMENDED_TAGS.slice(2, 5).map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-gold/5 border border-gold/10 text-gold rounded hover:bg-gold/10 transition-all cursor-pointer font-mono">
                {tag.tag}
              </span>
            ))}
         </div>
      </div>
    </div>
  );
}
