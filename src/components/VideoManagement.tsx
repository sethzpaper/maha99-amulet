import { useEffect, useState } from 'react';
import { VIDEO_RECORDS, FACEBOOK_POSTS, TIKTOK_POSTS, ADMIN_STATS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { VideoRecord, SocialPost } from '../types';
import { Check, Video, Share2, Facebook, Music2, Pencil, Trash2, Save, X, ExternalLink, Play } from 'lucide-react';
import { motion } from 'motion/react';

function getDrivePreviewUrl(link: string): string {
  const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return link;
}

function parseRecordDate(value?: string): number {
  if (!value) return 0;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;
  const [, dd, mm, yyyy] = match;
  return Date.parse(`${yyyy}-${mm}-${dd}`);
}

function formatRecordDate(value?: string): string {
  const parsed = parseRecordDate(value);
  if (!parsed) return value || '-';
  return new Date(parsed).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function VideoManagement() {
  const [records, setRecords] = useState<VideoRecord[]>(VIDEO_RECORDS);
  const [fbPosts, setFbPosts] = useState<SocialPost[]>(FACEBOOK_POSTS);
  const [ttPosts, setTtPosts] = useState<SocialPost[]>(TIKTOK_POSTS);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VideoRecord>>({});
  const [previewRecord, setPreviewRecord] = useState<VideoRecord | null>(null);

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
  const latestRecords = [...records]
    .sort((a, b) => parseRecordDate(b.entryDate) - parseRecordDate(a.entryDate))
    .slice(0, 3);

  const getFacebookReference = (record: VideoRecord) => {
    const normalized = record.productName.trim().toLowerCase();
    return fbPosts.find((post) => normalized && post.content?.toLowerCase().includes(normalized));
  };

  const startCreate = () => {
    setEditingId('new');
    setDraft({
      entryDate: new Date().toISOString().slice(0, 10),
      fileName: '',
      productName: '',
      productImage: '',
      driveLink: '',
      creator: ADMIN_STATS[0]?.name || '',
      isPostedFB: false,
      isPostedTT: false,
      fbViews: 0,
      fbLikes: 0,
      ttViews: 0,
      ttLikes: 0,
    });
  };

  const startEdit = (record: VideoRecord) => {
    setEditingId(record.id);
    setDraft(record);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveDraft = async () => {
    if (!draft.fileName || !draft.productName) return;
    setLoading(true);
    try {
      const saved = editingId === 'new'
        ? await dataService.createVideo(draft)
        : editingId
        ? await dataService.updateVideo(editingId, draft)
        : null;

      if (saved) {
        setRecords(prev => editingId === 'new'
          ? [saved, ...prev]
          : prev.map(record => record.id === saved.id ? saved : record)
        );
        cancelEdit();
      }
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = (id: string, patch: Partial<VideoRecord>) => {
    setRecords(prev => prev.map(record => record.id === id ? { ...record, ...patch } : record));
  };

  const persistRecord = async (record: VideoRecord) => {
    const saved = await dataService.updateVideo(record.id, record);
    if (saved) setRecords(prev => prev.map(item => item.id === saved.id ? saved : item));
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm('ลบวิดีโอนี้ใช่ไหม?')) return;
    const ok = await dataService.deleteVideo(id);
    if (ok) setRecords(prev => prev.filter(record => record.id !== id));
  };

  const toggleStatus = async (id: string, platform: 'fb' | 'tt') => {
    const now = new Date().toLocaleString('th-TH');
    let nextRecord: VideoRecord | null = null;
    setRecords(prev => prev.map(rec => {
      if (rec.id === id) {
        if (platform === 'fb') {
          nextRecord = { ...rec, isPostedFB: !rec.isPostedFB, fbPostDate: !rec.isPostedFB ? now : undefined };
          return nextRecord;
        } else {
          nextRecord = { ...rec, isPostedTT: !rec.isPostedTT, ttPostDate: !rec.isPostedTT ? now : undefined };
          return nextRecord;
        }
      }
      return rec;
    }));
    if (nextRecord) await persistRecord(nextRecord);
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

      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Latest Video Highlights</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">3 รายการล่าสุดพร้อมภาพพรีวิว</h3>
          </div>
          <p className="text-[11px] text-zinc-500">ถ้ายังไม่มีรูปจริง ระบบจะใช้พรีวิวอ้างอิงจากโพสต์ Facebook ที่ข้อความใกล้เคียง</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {latestRecords.map((record, index) => {
            const fbReference = getFacebookReference(record);
            return (
              <motion.button
                key={record.id}
                type="button"
                onClick={() => setPreviewRecord(record)}
                whileHover={{ y: -3 }}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60 text-left"
              >
                {record.productImage ? (
                  <img
                    src={record.productImage}
                    alt={record.productName}
                    className="h-52 w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-52 w-full bg-[linear-gradient(135deg,#1d4ed8_0%,#0f172a_45%,#111827_100%)] p-5 text-white">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100">
                      <span>Facebook Preview</span>
                      <Facebook className="h-4 w-4" />
                    </div>
                    <div className="mt-8 rounded-3xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
                      <p className="text-lg font-bold leading-tight">{record.productName}</p>
                      <p className="mt-3 line-clamp-3 text-sm text-blue-100/90">
                        {fbReference?.content || record.fileName}
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                      ล่าสุด #{index + 1}
                    </span>
                    <span className="text-[11px] text-zinc-500">{formatRecordDate(record.entryDate)}</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-100">{record.productName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{record.fileName}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>{record.creator || 'ยังไม่ระบุผู้สร้าง'}</span>
                    <span>{record.isPostedFB ? 'โพสต์ Facebook แล้ว' : 'ยังไม่โพสต์ Facebook'}</span>
                  </div>
                </div>
              </motion.button>
            );
          })}
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
          <button
            onClick={startCreate}
            className="bg-gold/10 hover:bg-gold/20 text-gold text-[10px] font-bold py-2 px-4 rounded-full border border-gold/20 transition-all uppercase tracking-widest"
          >
             เพิ่มข้อมูลใหม่ +
          </button>
        </div>

        {editingId && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 rounded-2xl border border-gold/20 bg-zinc-950/40 p-4">
            <input className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" placeholder="วันที่" value={draft.entryDate || ''} onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })} />
            <input className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" placeholder="ชื่อไฟล์" value={draft.fileName || ''} onChange={(e) => setDraft({ ...draft, fileName: e.target.value })} />
            <input className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" placeholder="ชื่อสินค้า" value={draft.productName || ''} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} />
            <input className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" placeholder="ลิงก์ภาพนิ่ง / ภาพจาก Facebook" value={draft.productImage || ''} onChange={(e) => setDraft({ ...draft, productImage: e.target.value })} />
            <input className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" placeholder="Drive link" value={draft.driveLink || ''} onChange={(e) => setDraft({ ...draft, driveLink: e.target.value })} />
            <select className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300" value={draft.creator || ''} onChange={(e) => setDraft({ ...draft, creator: e.target.value })}>
              {ADMIN_STATS.map(admin => <option key={admin.id} value={admin.name}>{admin.name}</option>)}
            </select>
            {(['fbViews', 'fbLikes', 'ttViews', 'ttLikes'] as const).map(field => (
              <input
                key={field}
                type="number"
                min="0"
                className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-2 px-3 text-zinc-300"
                placeholder={field}
                value={draft[field] || 0}
                onChange={(e) => setDraft({ ...draft, [field]: Number(e.target.value) })}
              />
            ))}
            <div className="flex gap-2">
              <button onClick={saveDraft} disabled={loading} className="inline-flex items-center justify-center gap-2 bg-gold/20 hover:bg-gold/30 text-gold text-xs font-bold py-2 px-3 rounded-lg border border-gold/30 disabled:opacity-50">
                <Save className="h-4 w-4" /> Save
              </button>
              <button onClick={cancelEdit} className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold py-2 px-3 rounded-lg border border-zinc-800">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1320px]">
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
                <th className="pb-4 font-semibold px-2 text-right">FB Views</th>
                <th className="pb-4 font-semibold px-2 text-right">FB Likes</th>
                <th className="pb-4 font-semibold px-2 text-right">TT Views</th>
                <th className="pb-4 font-semibold px-2 text-right">TT Likes</th>
                <th className="pb-4 font-semibold px-2 text-right">วันที่โพสล่าสุด</th>
                <th className="pb-4 font-semibold px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {records.map((rec, i) => (
                <tr key={rec.id} className="group hover:bg-zinc-900/40 transition-all border-b border-zinc-900/20">
                  <td className="py-5 px-2 text-xs font-mono text-zinc-600">{(i + 1).toString().padStart(2, '0')}</td>
                  <td className="py-5 px-2 text-xs text-zinc-400">{rec.entryDate}</td>
                  <td className="py-5 px-2">
                    <button
                      onClick={() => setPreviewRecord(rec)}
                      className="flex items-center gap-2 text-left group/fn hover:text-gold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 text-gold/50 shrink-0 group-hover/fn:text-gold" />
                      <span className="text-sm font-medium text-zinc-300 group-hover/fn:text-gold underline-offset-2 hover:underline">{rec.fileName}</span>
                    </button>
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
                         updateRecord(rec.id, { creator: e.target.value });
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
                  {(['fbViews', 'fbLikes', 'ttViews', 'ttLikes'] as const).map(field => (
                    <td key={field} className="py-5 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={rec[field] || 0}
                        onChange={(e) => updateRecord(rec.id, { [field]: Number(e.target.value) })}
                        className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg text-xs py-1.5 px-2 text-right text-zinc-300 focus:outline-none focus:border-gold/50"
                      />
                    </td>
                  ))}
                  <td className="py-5 px-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                       <span className="text-[10px] text-zinc-500 font-mono italic">{rec.fbPostDate || '-'} (FB)</span>
                       <span className="text-[10px] text-zinc-500 font-mono italic">{rec.ttPostDate || '-'} (TT)</span>
                    </div>
                  </td>
                  <td className="py-5 px-2">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => persistRecord(rec)} className="p-2 bg-zinc-900 rounded-lg hover:bg-gold/10 text-gold transition-all" title="Save">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => startEdit(rec)} className="p-2 bg-zinc-900 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-all" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteRecord(rec.id)} className="p-2 bg-zinc-900 rounded-lg hover:bg-red-500/10 text-red-400 transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewRecord && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setPreviewRecord(null)}>
          <div className="w-full max-w-3xl bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
              <div>
                <p className="text-sm font-bold text-zinc-200">{previewRecord.fileName}</p>
                <p className="text-[10px] text-zinc-500">{previewRecord.productName}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={previewRecord.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                  <ExternalLink className="w-3.5 h-3.5" /> เปิด Drive
                </a>
                <button onClick={() => setPreviewRecord(null)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={getDrivePreviewUrl(previewRecord.driveLink)}
                className="w-full h-full"
                allow="autoplay"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
