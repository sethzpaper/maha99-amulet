import { useEffect, useState } from 'react';
import {
  Activity,
  Download,
  ExternalLink,
  Facebook,
  FileText,
  History,
  Link,
  Music2,
  Palette,
  Pencil,
  Plus,
  Printer,
  Save,
  Shield,
  Table,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { formatActivityTime, listActivityLogs, type ActivityLogRow } from '../lib/activityApi';
import { PasswordResetAdmin } from './PasswordResetAdmin';
import {
  createTrackedAccount,
  deleteTrackedAccount,
  listTrackedAccounts,
  TrackedAccount,
  updateTrackedAccount,
} from '../lib/employeeApi';

interface SettingsProps {
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
  userName?: string;
}

export function Settings({
  isSuperAdmin = false,
  isAdmin = false,
  isAuthenticated = false,
  userName = '',
}: SettingsProps) {
  const [exportType, setExportType] = useState('daily');
  const [settingsTab, setSettingsTab] = useState('social');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'classic';
    return window.localStorage.getItem('amulet_theme') || 'classic';
  });
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [accountForm, setAccountForm] = useState({
    platform: 'facebook' as 'facebook' | 'tiktok',
    account_name: '',
    account_url: '',
    account_handle: '',
    is_competitor: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const isEditing = editingId !== null;

  const loadAccounts = async () => {
    const list = await listTrackedAccounts();
    setAccounts(list);
  };

  const loadActivityLogs = async () => {
    const list = await listActivityLogs(50);
    setActivityLogs(list);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts();
      loadActivityLogs();
    }
  }, [isAuthenticated]);

  const showAccountMessage = (message: string) => {
    setAccountMessage(message);
    window.setTimeout(() => setAccountMessage(null), 2500);
  };

  const resetAccountForm = () => {
    setAccountForm({
      platform: 'facebook',
      account_name: '',
      account_url: '',
      account_handle: '',
      is_competitor: false,
    });
    setEditingId(null);
  };

  const handleEditAccount = (account: TrackedAccount) => {
    if (!isSuperAdmin) {
      showAccountMessage('เฉพาะ Super Admin เท่านั้น');
      return;
    }
    setEditingId(account.id);
    setAccountForm({
      platform: account.platform,
      account_name: account.account_name,
      account_url: account.account_url,
      account_handle: account.account_handle ?? '',
      is_competitor: account.is_competitor,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddAccount = async () => {
    if (!isSuperAdmin) {
      showAccountMessage('เฉพาะ Super Admin เท่านั้น');
      return;
    }
    if (!accountForm.account_name.trim() || !accountForm.account_url.trim()) {
      showAccountMessage('กรอกชื่อและลิงก์ก่อนบันทึก');
      return;
    }

    const payload = {
      ...accountForm,
      account_name: accountForm.account_name.trim(),
      account_url: accountForm.account_url.trim(),
      account_handle: accountForm.account_handle.trim(),
    };

    if (editingId) {
      await updateTrackedAccount('super_admin', editingId, payload);
      resetAccountForm();
      await loadAccounts();
      showAccountMessage('อัปเดตแหล่งข้อมูลสำเร็จ');
    } else {
      await createTrackedAccount('super_admin', payload);
      resetAccountForm();
      await loadAccounts();
      showAccountMessage('บันทึกแหล่งข้อมูลสำเร็จ');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!isSuperAdmin) {
      showAccountMessage('เฉพาะ Super Admin เท่านั้น');
      return;
    }
    await deleteTrackedAccount('super_admin', id);
    if (editingId === id) resetAccountForm();
    await loadAccounts();
    showAccountMessage('ลบแหล่งข้อมูลแล้ว');
  };

  const ownedAccounts = accounts.filter((account) => !account.is_competitor);
  const competitorAccounts = accounts.filter((account) => account.is_competitor);
  const themes = [
    { id: 'classic', label: 'Classic Gold', colors: ['#0c0900', '#d4af37'] },
    { id: 'jade', label: 'Jade', colors: ['#05130f', '#34d399'] },
    { id: 'ruby', label: 'Ruby', colors: ['#160607', '#f43f5e'] },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('amulet_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-zinc-100 italic">{isAuthenticated ? 'Settings & Export' : 'Settings'}</h2>
          <p className="text-zinc-500 text-sm">จัดการระบบและส่งออกรายงานสถิติ</p>
        </div>
      </div>

      {isAuthenticated && !isSuperAdmin && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <Lock className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-400">การเปลี่ยนแปลงการตั้งค่าสงวนไว้สำหรับ Super Admin เท่านั้น</p>
        </div>
      )}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 p-4 bg-gold/5 border border-gold/20 rounded-2xl">
          <Shield className="w-5 h-5 text-gold shrink-0" />
          <p className="text-xs text-gold">โหมด Super Admin - สามารถเปลี่ยนแปลงการตั้งค่าระบบได้ทั้งหมด</p>
        </div>
      )}

      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
            <Palette className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-serif italic font-bold text-zinc-100 gold-text-gradient">ธีมหน้าจอ</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">ผู้ใช้ทั่วไปเปลี่ยนได้</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                theme === item.id ? 'border-gold bg-gold/10 text-gold' : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs font-bold">{item.label}</span>
              <span className="flex gap-1">
                {item.colors.map((color) => (
                  <span key={color} className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isAuthenticated && (
        <>
        <div className="flex gap-1 bg-zinc-950/60 border border-zinc-900 p-1 rounded-2xl mb-6 flex-wrap">
          {(['social', 'export', 'system', 'log', 'password']).map((id) => {
            const labels = { social: 'แหล่ง Social', export: 'Export', system: 'ระบบ', log: 'บันทึก', password: 'พาสเวิร์ด' };
            return (
              <button
                key={id}
                onClick={() => setSettingsTab(id as any)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${settingsTab === id ? 'bg-gold/20 text-gold border border-gold/30' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {labels[id as keyof typeof labels]}
              </button>
            );
          })}
        </div>
      {settingsTab === 'social' && (
      <div className="glass-card p-8 rounded-3xl gold-border-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
              <Link className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Super Admin: ตั้งค่าแหล่งข้อมูล Social</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Fanpage, TikTok, Competitor links for graph and comparison</p>
            </div>
          </div>
          {accountMessage && (
            <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400">
              {accountMessage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-8">
          <div className="bg-zinc-950/50 rounded-2xl border border-zinc-900 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAccountForm({ ...accountForm, platform: 'facebook' })}
                disabled={!isSuperAdmin}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition ${
                  accountForm.platform === 'facebook'
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Facebook className="w-4 h-4" /> Facebook
              </button>
              <button
                onClick={() => setAccountForm({ ...accountForm, platform: 'tiktok' })}
                disabled={!isSuperAdmin}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition ${
                  accountForm.platform === 'tiktok'
                    ? 'border-pink-500/40 bg-pink-500/10 text-pink-400'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Music2 className="w-4 h-4" /> TikTok
              </button>
            </div>

            <input
              placeholder="ชื่อเพจ / ชื่อช่อง"
              value={accountForm.account_name}
              onChange={(event) => setAccountForm({ ...accountForm, account_name: event.target.value })}
              disabled={!isSuperAdmin}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-gold/40"
            />
            <input
              placeholder="ลิงก์ เช่น https://facebook.com/yourpage หรือ https://tiktok.com/@yourname"
              value={accountForm.account_url}
              onChange={(event) => setAccountForm({ ...accountForm, account_url: event.target.value })}
              disabled={!isSuperAdmin}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-gold/40"
            />
            <input
              placeholder="handle เช่น @mahaniyom999"
              value={accountForm.account_handle}
              onChange={(event) => setAccountForm({ ...accountForm, account_handle: event.target.value })}
              disabled={!isSuperAdmin}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-gold/40"
            />

            <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <span>
                <span className="block text-xs font-bold text-zinc-300">ใช้เป็นบัญชีคู่แข่ง</span>
                <span className="block text-[10px] text-zinc-600">ถ้าเปิด ระบบจะนำไปใช้ในหน้าเปรียบเทียบ</span>
              </span>
              <input
                type="checkbox"
                checked={accountForm.is_competitor}
                onChange={(event) => setAccountForm({ ...accountForm, is_competitor: event.target.checked })}
                disabled={!isSuperAdmin}
                className="h-4 w-4 accent-[#d4af37]"
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleAddAccount}
                disabled={!isSuperAdmin}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-xs font-black text-black transition hover:bg-[#e5c55d] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEditing ? (
                  <><Save className="w-4 h-4" /> อัปเดตแหล่งข้อมูล</>
                ) : (
                  <><Plus className="w-4 h-4" /> บันทึกแหล่งข้อมูล</>
                )}
              </button>
              {isEditing && (
                <button
                  onClick={resetAccountForm}
                  className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800"
                  title="ยกเลิกการแก้ไข"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isEditing && (
              <p className="text-[10px] text-amber-400 italic">
                กำลังแก้ไขรายการที่เลือก — กดอัปเดตเพื่อบันทึก หรือ × เพื่อยกเลิก
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AccountGroup title="ช่องของเรา" accounts={ownedAccounts} onDelete={handleDeleteAccount} onEdit={handleEditAccount} canEdit={isSuperAdmin} editingId={editingId} />
            <AccountGroup title="บัญชีคู่แข่ง" accounts={competitorAccounts} onDelete={handleDeleteAccount} onEdit={handleEditAccount} canEdit={isSuperAdmin} editingId={editingId} />
          </div>
        </div>

        <p className="mt-5 text-[10px] text-zinc-600 leading-5">
          ลิงก์ที่ตั้งค่านี้จะถูกใช้ร่วมกันในหน้าโพส Facebook, โพส TikTok, กราฟ social summary และหน้าเปรียบเทียบคู่แข่ง หากไม่มี API backend ระบบจะเก็บค่าไว้ใน browser ด้วย localStorage ก่อน
        </p>
      </div>
      )}
      {settingsTab === 'export' && (
        <div className="glass-card p-8 rounded-3xl gold-border-glow">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
                <Download className="w-6 h-6 text-gold" />
             </div>
             <div>
                <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Export รายงาน</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Daily, Monthly, Yearly Analysis</p>
             </div>
          </div>

          <div className="space-y-6">
            <div>
               <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3 block">เลือกช่วงเวลา</label>
               <div className="grid grid-cols-3 gap-3">
                  {['daily', 'monthly', 'yearly'].map(type => (
                    <button 
                      key={type}
                      onClick={() => setExportType(type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        exportType === type ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      {type === 'daily' ? 'รายวัน' : type === 'monthly' ? 'รายเดือน' : 'รายปี'}
                    </button>
                  ))}
               </div>
            </div>

            <div className="pt-6 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <button disabled={!isSuperAdmin} className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-2xl transition-all font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                  <FileText className="w-4 h-4" /> Export PDF
               </button>
               <button disabled={!isSuperAdmin} className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-3 rounded-2xl transition-all font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                  <Table className="w-4 h-4" /> Export Excel
               </button>
               <button disabled={!isSuperAdmin} className="sm:col-span-2 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 py-3 rounded-2xl transition-all font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                  <Printer className="w-4 h-4" /> พิมพ์รายงาน (Print)
               </button>
            </div>
          </div>
        </div>
      )}
      {settingsTab === 'system' && (
      <div className="glass-card p-8 rounded-3xl gold-border-glow border-zinc-800/50">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-zinc-900/50 rounded-xl flex items-center justify-center border border-zinc-800">
                 <Save className="w-6 h-6 text-zinc-500" />
              </div>
              <div>
                 <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">การตั้งค่าระบบ</h3>
                 <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">System Configuration</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900">
                 <div>
                    <p className="text-sm font-bold text-zinc-300">แจ้งเตือนผ่าน LINE</p>
                    <p className="text-[10px] text-zinc-500">ส่งรายงานสรุปอัตโนมัติทุกสิ้นวัน</p>
                 </div>
                 <div className="w-12 h-6 bg-gold rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-black rounded-full shadow-sm" />
                 </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900">
                 <div>
                    <p className="text-sm font-bold text-zinc-300">สำรองข้อมูลอัตโนมัติ</p>
                    <p className="text-[10px] text-zinc-500">Backup ดาต้าเบสไปพื้นที่ Google Drive</p>
                 </div>
                 <div className="w-12 h-6 bg-zinc-800 rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-500 rounded-full" />
                 </div>
              </div>
           </div>
      </div>
      )}
      {settingsTab === 'log' && (
      <div className="glass-card p-8 rounded-3xl gold-border-glow">
         <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
               <History className="w-6 h-6 text-blue-500" />
            </div>
            <div>
               <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">บันทึกกิจกรรม (Activity Log)</h3>
               <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">System Audit & User Actions</p>
            </div>
         </div>

         <div className="space-y-4">
            {activityLogs.length === 0 ? (
              <p className="text-xs text-zinc-600 italic text-center py-6">
                ยังไม่มีบันทึกกิจกรรม — รัน <code className="text-zinc-400 bg-zinc-900 px-1 rounded">sql/activity_logs.sql</code> เพื่อเปิดใช้งาน
              </p>
            ) : activityLogs.map(log => (
              <div key={log.id} className="flex items-start gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900 hover:border-zinc-700 transition-all group">
                 <div className={`mt-1 p-2 rounded-lg ${
                    log.type === 'update' ? 'bg-amber-500/10 text-amber-500' :
                    log.type === 'create' ? 'bg-emerald-500/10 text-emerald-500' :
                    log.type === 'delete' ? 'bg-red-500/10 text-red-500' :
                    'bg-blue-500/10 text-blue-500'
                 }`}>
                    {log.type === 'update' ? <Activity className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                 </div>
                 <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                       <p className="text-xs font-bold text-zinc-200 group-hover:text-gold transition-colors">{log.user_name}</p>
                       <span className="text-[10px] font-mono text-zinc-600">{formatActivityTime(log.created_at)}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{log.action}</p>
                    {log.details && (
                      <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">{log.details}</p>
                    )}
                 </div>
              </div>
            ))}
         </div>

         <button onClick={loadActivityLogs} className="w-full mt-8 py-3 bg-zinc-900/50 hover:bg-zinc-900 text-[10px] font-bold text-zinc-500 border border-zinc-800 rounded-2xl transition-all uppercase tracking-widest leading-none">
            รีเฟรชบันทึก (แสดง 50 รายการล่าสุด)
         </button>
      </div>
      )}
      {settingsTab === 'password' && (
        <div className="glass-card p-6 rounded-3xl gold-border-glow">
          <PasswordResetAdmin
            approverName={userName || (isSuperAdmin ? 'super_admin' : 'admin')}
            canApprove={isAdmin || isSuperAdmin}
          />
        </div>
      )}
        </>
      )}
    </div>
  );
}

function AccountGroup({
  accounts,
  canEdit,
  onDelete,
  onEdit,
  title,
  editingId,
}: {
  accounts: TrackedAccount[];
  canEdit: boolean;
  onDelete: (id: string) => void;
  onEdit: (account: TrackedAccount) => void;
  title: string;
  editingId: string | null;
}) {
  return (
    <div className="bg-zinc-950/50 rounded-2xl border border-zinc-900 p-5">
      <h4 className="text-xs font-bold text-zinc-300 mb-4">{title}</h4>
      <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
        {accounts.length === 0 ? (
          <p className="text-[10px] text-zinc-600">ยังไม่มีข้อมูล</p>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className={`rounded-xl border bg-zinc-900/60 p-3 ${
                editingId === account.id ? 'border-gold/60 ring-1 ring-gold/30' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {account.platform === 'facebook' ? (
                      <Facebook className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Music2 className="w-3.5 h-3.5 text-pink-400" />
                    )}
                    <p className="truncate text-xs font-bold text-zinc-200">{account.account_name}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{account.account_handle || account.platform}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={!canEdit}
                    onClick={() => onEdit(account)}
                    className="text-amber-400 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="แก้ไข"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    disabled={!canEdit}
                    onClick={() => onDelete(account.id)}
                    className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="ลบ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <a
                href={account.account_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-1 truncate text-[10px] text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3 shrink-0" /> {account.account_url}
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
