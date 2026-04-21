import { ThumbsUp, Flame, ExternalLink, Hash, Plus, Trash2, Link, Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { RECOMMENDED_TAGS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { SocialPost } from '../types';
import { useAuthStore } from '../lib/authStore';
import {
  listTrackedAccounts,
  createTrackedAccount,
  deleteTrackedAccount,
  TrackedAccount,
} from '../lib/employeeApi';

export function FacebookPosts() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [newAccount, setNewAccount] = useState({ account_name: '', account_url: '', account_handle: '', is_competitor: false });
  const [toast, setToast] = useState<string | null>(null);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadAccounts = async () => {
    try {
      const list = await listTrackedAccounts({ platform: 'facebook' });
      setAccounts(Array.isArray(list) ? list : []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await dataService.fetchFacebookPosts();
      setPosts(data.slice(0, 10));
      setLoading(false);
    };
    fetch();
    loadAccounts();
    const interval = setInterval(fetch, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddAccount = async () => {
    if (!newAccount.account_name || !newAccount.account_url) return;
    try {
      await createTrackedAccount('super_admin', { ...newAccount, platform: 'facebook' });
      showMsg('เพิ่มลิงก์สำเร็จ');
      setNewAccount({ account_name: '', account_url: '', account_handle: '', is_competitor: false });
      await loadAccounts();
    } catch (e: any) { showMsg(e.message); }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteTrackedAccount('super_admin', id);
      showMsg('ลบลิงก์สำเร็จ');
      await loadAccounts();
    } catch (e: any) { showMsg(e.message); }
  };

  return (
    <div className="glass-card p-8 rounded-3xl flex flex-col gold-border-glow">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold rounded-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">โพสล่าสุดจาก Facebook</h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Real-time Social Activity</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowManage(!showManage)}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg px-2 py-1 transition">
            <Settings2 className="w-3 h-3" /> จัดการลิงก์
          </button>
        )}
      </div>

      {/* Manage Accounts Panel (super admin) */}
      {isSuperAdmin && showManage && (
        <div className="mb-6 p-5 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
            <Link className="w-3 h-3" /> เพจ Facebook ที่ติดตาม
          </h4>
          {/* Existing accounts */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {accounts.length === 0 && <p className="text-[10px] text-zinc-600">ยังไม่มีลิงก์</p>}
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-zinc-900 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{a.account_name}</p>
                  <a href={a.account_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline truncate block max-w-xs">{a.account_url}</a>
                </div>
                <div className="flex items-center gap-2">
                  {a.is_competitor && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">คู่แข่ง</span>}
                  <button onClick={() => handleDeleteAccount(a.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          {/* Add form */}
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="ชื่อเพจ" value={newAccount.account_name} onChange={e => setNewAccount({ ...newAccount, account_name: e.target.value })}
              className="col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600" />
            <input placeholder="URL เพจ" value={newAccount.account_url} onChange={e => setNewAccount({ ...newAccount, account_url: e.target.value })}
              className="col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600" />
            <div className="flex items-center gap-2 col-span-1">
              <input type="checkbox" id="fb-competitor" checked={newAccount.is_competitor} onChange={e => setNewAccount({ ...newAccount, is_competitor: e.target.checked })} />
              <label htmlFor="fb-competitor" className="text-[10px] text-zinc-400">เป็นคู่แข่ง</label>
            </div>
            <button onClick={handleAddAccount} className="flex items-center justify-center gap-1 bg-blue-600 text-white text-xs font-bold rounded-xl px-3 py-2 hover:bg-blue-700">
              <Plus className="w-3 h-3" /> เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* Posts Table */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center h-32"><p className="text-zinc-400">กำลังโหลด...</p></div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center h-32"><p className="text-zinc-400">ไม่มีข้อมูลโพสต์</p></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50">
                <th className="pb-4 font-semibold text-zinc-200">คอนเทนต์</th>
                <th className="pb-4 font-semibold text-center text-zinc-200"><ThumbsUp className="w-3 h-3 inline mr-1" /> ไลก์</th>
                <th className="pb-4 font-semibold text-right text-zinc-200"><Flame className="w-3 h-3 inline mr-1" /> กระแส</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {posts.map((post, i) => (
                <tr key={i} className="group hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3"><p className="text-sm text-zinc-300 group-hover:text-zinc-100 line-clamp-1">{post.content}</p></td>
                  <td className="py-3 text-center text-xs text-blue-400 font-mono">{post.engagement}</td>
                  <td className="py-3 text-right"><span className="text-xs text-amber-500 font-mono">{Math.floor(post.engagement * 0.3)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button className="w-full mt-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 text-[10px] font-bold text-zinc-400 border border-zinc-800 rounded-xl transition-all flex items-center justify-center gap-2">
        <ExternalLink className="w-3 h-3" /> ดูโพสทั้งหมด
      </button>

      {/* Tracked pages list */}
      {accounts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 uppercase mb-2 flex items-center gap-1"><Link className="w-3 h-3" /> เพจที่ติดตาม</p>
          <div className="flex flex-wrap gap-2">
            {accounts.filter(a => !a.is_competitor).slice(0, 4).map(a => (
              <a key={a.id} href={a.account_url} target="_blank" rel="noreferrer"
                className="text-[10px] px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded hover:bg-blue-500/20 transition font-mono">
                {a.account_name}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-3 h-3 text-gold" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recommended #Tags</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED_TAGS.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-gold/5 border border-gold/10 text-gold rounded hover:bg-gold/10 transition-all cursor-pointer font-mono">
              {tag.tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
