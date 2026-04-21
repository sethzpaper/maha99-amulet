import { useEffect, useState } from 'react';
import { VIDEO_RECORDS, FACEBOOK_POSTS, TIKTOK_POSTS, ADMIN_STATS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { VideoRecord, SocialPost } from '../types';
import { ExternalLink, Check, Video, Share2, Facebook, Music2 } from 'lucide-react';
import { motion } from 'motion/react';

export function VideoManagement() {
  const [records, setRecords] = useState<VideoRecord[]>(VIDEO_RECORDS);
  const [fbPosts, setFbPosts] = useState<SocialPost[]>(FACEBOOK_POSTS);
  const [ttPosts, setTtPosts] = useState<SocialPost[]>(TIKTOK_POSTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [videos, fb, tt] = await Promise.all([
          dataService.fetchVideos(),
          dataService.fetchFacebookPosts(),
          dataService.fetchTikTokPosts(),
        ]);
        
        if (videos && videos.length > 0) setRecords(videos);
        if (fb && fb.length > 0) setFbPosts(fb);
        if (tt && tt.length > 0) setTtPosts(tt);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const topFB = fbPosts[0];
  const topTT = ttPosts[0];

  const toggleStatus = (id: string, platform: 'fb' | 'tt') => {
    const now = new Date().toLocaleString('th-TH');
    setRecords(prev => prev.map(rec => {
      if (rec.id === id) {
        if (platform === 'fb') {
          return { ...rec, isPostedFB: !rec.isPostedFB, fbPostDate: !rec.isPostedFB ? now : undefined };
        } else {
          return { ...rec, isPostedTT: !rec.isPostedTT, ttPostDate: !rec.isPostedTT ? now : undefined };
        }
      }
      return rec;
    }));
  };

  return (
    <div className="space-y-8">
      {/* Top Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-3xl gold-border-glow border-blue-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Facebook className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold gold-text-gradient uppercase tracking-widest">โพสยอดนิยม Facebook</h3>
          </div>
          {topFB && (
            <>
              <p className="text-zinc-300 text-sm line-clamp-2 mb-4 italic">"{topFB.content}"</p>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Engagement: {topFB.engagement.toLocaleString()}</span>
                <button className="text-blue-400 hover:underline">ดูโพสต์</button>
              </div>
            </>
          )}
        </div>

        <div className="glass-card p-6 rounded-3xl gold-border-glow border-pink-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Music2 className="w-5 h-5 text-pink-500" />
            <h3 className="text-sm font-bold gold-text-gradient uppercase tracking-widest">โพสยอดนิยม TikTok</h3>
          </div>
          {topTT && (
            <>
              <p className="text-zinc-300 text-sm line-clamp-2 mb-4 italic">"{topTT.content}"</p>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Views: {topTT.engagement.toLocaleString()}</span>
                <button className="text-pink-400 hover:underline">ดูวิดีโอ</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Video Management Table */}
      <div className="glass-card p-8 rounded-3xl gold-border-glow relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
                <Video className="w-6 h-6 text-gold" />
             </div>
             <div>
                <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">ระบบจัดการวิดิโอ</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Video Asset Management System (Mahaniyom 99)</p>
             </div>
          </div>
          <button className="bg-gold/10 hover:bg-gold/20 text-gold text-[10px] font-bold py-2 px-4 rounded-full border border-gold/20 transition-all uppercase tracking-widest">
             เพิ่มข้อมูลใหม่ +
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] border-b border-zinc-800/50">
                <th className="pb-4 font-semibold px-2">ลำดับ</th>
                <th className="pb-4 font-semibold px-2">วันที่ลงข้อมูล</th>
                <th className="pb-4 font-semibold px-2">ชื่อไฟล์</th>
                <th className="pb-4 font-semibold px-2">ชื่อสินค้า</th>
                <th className="pb-4 font-semibold px-2">Link Drive</th>
                <th className="pb-4 font-semibold px-2">ผู้สร้าง</th>
                <th className="pb-4 font-semibold px-2 text-center">FB</th>
                <th className="pb-4 font-semibold px-3 text-center">TT</th>
                <th className="pb-4 font-semibold px-2 text-right">วันที่โพสล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {records.map((rec, i) => (
                <tr key={rec.id} className="group hover:bg-zinc-900/40 transition-all border-b border-zinc-900/20">
                  <td className="py-5 px-2 text-xs font-mono text-zinc-600">{(i + 1).toString().padStart(2, '0')}</td>
                  <td className="py-5 px-2 text-xs text-zinc-400">{rec.entryDate}</td>
                  <td className="py-5 px-2">
                    <div className="flex flex-col">
                       <span className="text-sm font-medium text-zinc-300 group-hover:text-gold transition-colors">{rec.fileName}</span>
                    </div>
                  </td>
                  <td className="py-5 px-2 text-sm text-zinc-500">{rec.productName}</td>
                  <td className="py-5 px-2">
                    <a href={rec.driveLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-800/50 rounded-lg hover:bg-blue-500/20 text-blue-500 transition-all inline-block">
                       <Share2 className="w-4 h-4" />
                    </a>
                  </td>
                  <td className="py-5 px-2">
                    <select 
                      className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-gold/50 text-zinc-400"
                      value={rec.creator}
                      onChange={(e) => {
                         const updated = records.map(r => r.id === rec.id ? {...r, creator: e.target.value} : r);
                         setRecords(updated);
                      }}
                    >
                      {ADMIN_STATS.map(admin => (
                        <option key={admin.id} value={admin.name}>{admin.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-5 px-2 text-center">
                    <button 
                      onClick={() => toggleStatus(rec.id, 'fb')}
                      className={`w-6 h-6 rounded border transition-all flex items-center justify-center mx-auto ${rec.isPostedFB ? 'bg-blue-500 border-blue-400 text-white' : 'bg-transparent border-zinc-700 text-transparent hover:border-blue-500/50'}`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="py-5 px-3 text-center">
                    <button 
                      onClick={() => toggleStatus(rec.id, 'tt')}
                      className={`w-6 h-6 rounded border transition-all flex items-center justify-center mx-auto ${rec.isPostedTT ? 'bg-pink-500 border-pink-400 text-white' : 'bg-transparent border-zinc-700 text-transparent hover:border-pink-500/50'}`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="py-5 px-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                       <span className="text-[10px] text-zinc-500 font-mono italic">{rec.fbPostDate || '-'} (FB)</span>
                       <span className="text-[10px] text-zinc-500 font-mono italic">{rec.ttPostDate || '-'} (TT)</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
