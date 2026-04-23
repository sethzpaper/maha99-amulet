import { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Calendar, Briefcase, Clock,
  Plus, Trash2, Edit2, Save, X, Award
} from 'lucide-react';
import {
  Employee, Badge, EmployeeBadge,
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
  listBadges, createBadge, deleteBadge, awardBadge, removeBadgeAward,
  calcTenure,
} from '../lib/employeeApi';
import { useAuthStore } from '../lib/authStore';
import { AvatarPicker } from './AvatarPicker';

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-[200] px-5 py-3 rounded-2xl font-semibold text-sm shadow-lg ${
      type === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'
    }`}>
      {msg}
    </div>
  );
}

const LEAVE_TYPES: Record<string, string> = {
  personal: 'ลากิจ', sick: 'ลาป่วย', vacation: 'ลาพักร้อน', other: 'อื่น ๆ',
};

export function EmployeeProfile() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<(Employee & { badges: EmployeeBadge[] }) | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => setToast({ type, msg });

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee> & { password?: string }>({});

  // badge management
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: '', description: '', icon: '🏅', color: '#d4af37' });
  const [awardEmpId, setAwardEmpId] = useState('');
  const [awardBadgeId, setAwardBadgeId] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [empList, badgeList] = await Promise.all([listEmployees(), listBadges()]);
      setEmployees(Array.isArray(empList) ? empList : []);
      setBadges(Array.isArray(badgeList) ? badgeList : []);
    } catch { showToast('error', 'โหลดข้อมูลไม่สำเร็จ'); }
    setLoading(false);
  };

  const selectEmployee = async (emp: Employee) => {
    try {
      const detail = await getEmployee(emp.id);
      setSelected(detail);
      setFormData(detail);
      setEditMode(false);
    } catch { showToast('error', 'โหลดรายละเอียดไม่สำเร็จ'); }
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      await updateEmployee('super_admin', selected.id, formData);
      showToast('success', 'บันทึกสำเร็จ');
      setEditMode(false);
      await load();
      const updated = await getEmployee(selected.id);
      setSelected(updated);
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleCreate = async () => {
    try {
      await createEmployee('super_admin', formData);
      showToast('success', 'เพิ่มพนักงานสำเร็จ');
      setShowForm(false);
      setFormData({});
      await load();
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันลบพนักงานนี้?')) return;
    try {
      await deleteEmployee('super_admin', id);
      showToast('success', 'ลบพนักงานสำเร็จ');
      setSelected(null);
      await load();
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleCreateBadge = async () => {
    try {
      await createBadge('super_admin', newBadge);
      showToast('success', 'สร้างรางวัลสำเร็จ');
      setNewBadge({ name: '', description: '', icon: '🏅', color: '#d4af37' });
      await load();
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleDeleteBadge = async (id: string) => {
    try {
      await deleteBadge('super_admin', id);
      showToast('success', 'ลบรางวัลสำเร็จ');
      await load();
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleAwardBadge = async () => {
    if (!awardEmpId || !awardBadgeId) return;
    try {
      await awardBadge('super_admin', awardEmpId, awardBadgeId);
      showToast('success', 'มอบรางวัลสำเร็จ');
      setAwardEmpId(''); setAwardBadgeId('');
      if (selected?.id === awardEmpId) {
        const updated = await getEmployee(awardEmpId);
        setSelected(updated);
      }
    } catch (e: any) { showToast('error', e.message); }
  };

  const handleRemoveBadge = async (empId: string, awardId: string) => {
    try {
      await removeBadgeAward('super_admin', empId, awardId);
      showToast('success', 'ถอดรางวัลแล้ว');
      const updated = await getEmployee(empId);
      setSelected(updated);
    } catch (e: any) { showToast('error', e.message); }
  };

  const filtered = employees.filter(e =>
    e.nickname.toLowerCase().includes(search.toLowerCase()) ||
    e.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const tenure = selected?.start_date ? calcTenure(selected.start_date) : null;

  const FieldEdit = ({ label, field, type = 'text' }: { label: string; field: keyof typeof formData; type?: string }) => (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
      {editMode || showForm ? (
        <input
          type={type}
          value={(formData[field] as string) || ''}
          onChange={e => setFormData({ ...formData, [field]: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      ) : (
        <p className="text-sm font-medium text-slate-900">
          {field === 'birthday' || field === 'start_date'
            ? (selected?.[field] ? new Date(selected[field] as string).toLocaleDateString('th-TH') : '-')
            : (selected?.[field] as string) || '-'}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">พนักงาน</h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Employee Management</p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setShowBadgeForm(!showBadgeForm); }} className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100">
              <Award className="w-4 h-4" /> จัดการรางวัล
            </button>
            <button onClick={() => { setShowForm(true); setSelected(null); setFormData({}); }} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700">
              <Plus className="w-4 h-4" /> เพิ่มพนักงาน
            </button>
          </div>
        )}
      </div>

      {/* Badge Management Panel (super admin) */}
      {isSuperAdmin && showBadgeForm && (
        <div className="bg-white border border-amber-200 rounded-3xl p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> จัดการเหรียญรางวัล</h3>

          {/* Existing badges */}
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm" style={{ borderColor: b.color, color: b.color }}>
                <span>{b.icon}</span> <span>{b.name}</span>
                <button onClick={() => handleDeleteBadge(b.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>

          {/* Create badge */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="ชื่อรางวัล" value={newBadge.name} onChange={e => setNewBadge({ ...newBadge, name: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm col-span-2" />
            <input placeholder="คำอธิบาย" value={newBadge.description} onChange={e => setNewBadge({ ...newBadge, description: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm col-span-2" />
            <div className="flex gap-2 col-span-1">
              <input placeholder="icon 🏅" value={newBadge.icon} onChange={e => setNewBadge({ ...newBadge, icon: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm w-20" />
              <input type="color" value={newBadge.color} onChange={e => setNewBadge({ ...newBadge, color: e.target.value })}
                className="h-10 w-10 rounded-xl border border-slate-200 cursor-pointer" />
            </div>
            <button onClick={handleCreateBadge} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">
              + สร้าง
            </button>
          </div>

          {/* Award badge to employee */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-[10px] text-slate-500 uppercase block mb-1">มอบรางวัลให้</label>
              <select value={awardEmpId} onChange={e => setAwardEmpId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <option value="">-- เลือกพนักงาน --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.nickname}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block mb-1">รางวัล</label>
              <select value={awardBadgeId} onChange={e => setAwardBadgeId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <option value="">-- เลือกรางวัล --</option>
                {badges.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
              </select>
            </div>
            <button onClick={handleAwardBadge} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">
              มอบรางวัล
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Employee list */}
        <div className="lg:col-span-1">
          <input
            placeholder="ค้นหา..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-2xl border border-slate-200 bg-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {loading && <p className="text-center text-slate-400 py-4 text-sm">กำลังโหลด...</p>}
            {!loading && filtered.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">ไม่พบพนักงาน</p>}
            {filtered.map(emp => (
              <button key={emp.id} onClick={() => selectEmployee(emp)}
                className={`w-full text-left p-3 rounded-2xl border transition-all ${selected?.id === emp.id ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  {emp.avatar_url
                    ? <img src={emp.avatar_url} alt={emp.nickname} className="w-10 h-10 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                    : <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg">{emp.nickname[0]}</div>
                  }
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{emp.nickname}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.position || '-'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Employee detail */}
        <div className="lg:col-span-3">
          {/* Add Employee Form */}
          {showForm && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900 text-lg">เพิ่มพนักงานใหม่</h3>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['ชื่อเล่น *', 'nickname'], ['ชื่อ-สกุล', 'full_name'],
                  ['ตำแหน่ง', 'position'], ['อีเมล', 'email'],
                  ['เบอร์โทร', 'phone'],
                  ['วันเกิด', 'birthday', 'date'], ['วันเริ่มงาน', 'start_date', 'date'],
                ] as [string, keyof typeof formData, string?][]).map(([label, field, type]) => (
                  <div key={field as string}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
                    <input type={type || 'text'} value={(formData[field] as string) || ''}
                      onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">รหัสผ่าน</label>
                  <input type="password" value={formData.password || ''}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">บทบาท</label>
                  <select value={formData.role || 'user'} onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <AvatarPicker
                value={formData.avatar_url as string | undefined}
                onChange={(url) => setFormData({ ...formData, avatar_url: url })}
              />
              <div className="flex gap-3">
                <button onClick={handleCreate} className="px-6 py-2 rounded-2xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700">บันทึก</button>
                <button onClick={() => { setShowForm(false); setFormData({}); }} className="px-6 py-2 rounded-2xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200">ยกเลิก</button>
              </div>
            </div>
          )}

          {/* Employee Detail Card */}
          {selected && !showForm && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
              {/* Profile header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  {selected.avatar_url
                    ? <img src={selected.avatar_url} alt={selected.nickname} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200" referrerPolicy="no-referrer" />
                    : <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-3xl">{selected.nickname[0]}</div>
                  }
                  <div>
                    <p className="text-3xl font-bold text-slate-900">{selected.nickname}</p>
                    <p className="text-sm text-slate-500">{selected.full_name || '-'}</p>
                    <p className="text-xs text-sky-600 font-semibold mt-1 uppercase">{selected.position || 'ไม่ระบุตำแหน่ง'}</p>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-2">
                    {editMode
                      ? <>
                          <button onClick={handleSave} className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Save className="w-4 h-4" /></button>
                          <button onClick={() => { setEditMode(false); setFormData(selected); }} className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"><X className="w-4 h-4" /></button>
                        </>
                      : <>
                          <button onClick={() => setEditMode(true)} className="p-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(selected.id)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                        </>
                    }
                  </div>
                )}
              </div>

              {/* Tenure */}
              {tenure && (
                <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                  <Clock className="w-5 h-5 text-sky-500" />
                  <div>
                    <p className="text-[10px] text-sky-400 uppercase font-semibold">อายุงาน</p>
                    <p className="text-sm font-bold text-sky-800">
                      {tenure.years} ปี {tenure.months} เดือน {tenure.days} วัน
                    </p>
                  </div>
                </div>
              )}

              {/* Badges */}
              {selected.badges && selected.badges.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">เหรียญรางวัล</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.badges.map(eb => (
                      <div key={eb.id} title={eb.badge.description || eb.badge.name}
                        className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-default"
                        style={{ borderColor: eb.badge.color, color: eb.badge.color, backgroundColor: `${eb.badge.color}15` }}
                      >
                        <span>{eb.badge.icon}</span>
                        <span>{eb.badge.name}</span>
                        {/* tooltip */}
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap z-10">
                          {eb.badge.description || eb.badge.name}
                        </div>
                        {isSuperAdmin && (
                          <button onClick={() => handleRemoveBadge(selected.id, eb.id)} className="ml-1 text-red-400 hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields */}
              <div className="grid grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <FieldEdit label="อีเมล" field="email" type="email" />
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <FieldEdit label="เบอร์โทร" field="phone" />
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <FieldEdit label="วันเกิด" field="birthday" type="date" />
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <FieldEdit label="ตำแหน่ง" field="position" />
                </div>
                {editMode && (
                  <div className="col-span-2">
                    <AvatarPicker
                      value={formData.avatar_url as string | undefined}
                      onChange={(url) => setFormData({ ...formData, avatar_url: url })}
                    />
                  </div>
                )}
                {editMode && (
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                    <input type="password" value={formData.password || ''}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                  </div>
                )}
              </div>
            </div>
          )}

          {!selected && !showForm && (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 flex items-center justify-center min-h-64 text-slate-400">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">เลือกพนักงานเพื่อดูรายละเอียด</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
