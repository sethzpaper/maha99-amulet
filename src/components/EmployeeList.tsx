import { useState, useEffect } from 'react';
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, Employee,
} from '../lib/employeeApi';
import { useAuthStore } from '../lib/authStore';
import {
  Calendar, Code, Edit2, Mail, Phone, Plus, Save, Trash2, User, X,
} from 'lucide-react';

const FIELD_CLS = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-gold/50';

export function EmployeeList() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editData, setEditData] = useState<Partial<Employee> & { password?: string }>({});
  const [newData, setNewData] = useState<Partial<Employee> & { password?: string }>({
    nickname: '', full_name: '', email: '', phone: '', position: '',
    role: 'user', is_active: true, password: '',
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const list = await listEmployees();
      setEmployees(Array.isArray(list) ? list : []);
    } catch { showToast('error', 'โหลดรายชื่อพนักงานไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const handleSelectEmployee = async (emp: Employee) => {
    try {
      const detail = await getEmployee(emp.id);
      setSelectedEmployee(detail);
      setEditData(detail);
      setIsEditing(false);
      setShowCreate(false);
    } catch { showToast('error', 'โหลดข้อมูลพนักงานไม่สำเร็จ'); }
  };

  const handleSave = async () => {
    if (!selectedEmployee || !user) return;
    try {
      await updateEmployee(user.role || 'user', selectedEmployee.id, editData);
      showToast('success', 'บันทึกข้อมูลสำเร็จ');
      setIsEditing(false);
      loadEmployees();
      const updated = await getEmployee(selectedEmployee.id);
      setSelectedEmployee(updated);
      setEditData(updated);
    } catch (err: any) { showToast('error', err.message || 'บันทึกไม่สำเร็จ'); }
  };

  const handleCreate = async () => {
    if (!user || !newData.nickname || !newData.password) {
      showToast('error', 'กรุณากรอกชื่อเล่นและรหัสผ่าน');
      return;
    }
    try {
      await createEmployee(user.role, newData);
      showToast('success', 'สร้างพนักงานใหม่สำเร็จ');
      setShowCreate(false);
      setNewData({ nickname: '', full_name: '', email: '', phone: '', position: '', role: 'user', is_active: true, password: '' });
      loadEmployees();
    } catch (err: any) { showToast('error', err.message || 'สร้างไม่สำเร็จ'); }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteEmployee(user.role, id);
      showToast('success', 'ลบพนักงานสำเร็จ');
      setConfirmDelete(null);
      if (selectedEmployee?.id === id) setSelectedEmployee(null);
      loadEmployees();
    } catch (err: any) { showToast('error', err.message || 'ลบไม่สำเร็จ'); }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded-2xl text-sm font-semibold z-50 border ${
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif italic font-bold gold-text-gradient">รายชื่อพนักงาน</h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Employee Directory</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowCreate(true); setSelectedEmployee(null); setIsEditing(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold text-xs font-bold rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> เพิ่มพนักงาน
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee list */}
        <div className="lg:col-span-1 space-y-3">
          <div className="sticky top-20">
            <input type="text" placeholder="ค้นหาพนักงาน..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-gold/50 placeholder-zinc-600"
            />
            <div className="mt-3 space-y-1.5 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-zinc-500 text-sm">กำลังโหลด...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">ไม่พบพนักงาน</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <div key={emp.id} className={`group flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedEmployee?.id === emp.id ? 'bg-gold/10 border-gold/30' : 'bg-zinc-950/50 border-zinc-900 hover:border-zinc-700'
                  }`} onClick={() => handleSelectEmployee(emp)}>
                    {emp.avatar_url
                      ? <img src={emp.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                      : <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                          <span className="text-sm font-bold text-[#c4982f]">{emp.nickname[0]}</span>
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate">{emp.nickname}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{emp.position || 'ไม่ระบุ'}</p>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(emp.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail / Create */}
        <div className="lg:col-span-2">
          {/* Create form */}
          {showCreate && isSuperAdmin && (
            <div className="glass-card p-8 rounded-3xl gold-border-glow space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic font-bold gold-text-gradient">เพิ่มพนักงานใหม่</h3>
                <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'nickname', label: 'ชื่อเล่น *', type: 'text' },
                  { key: 'full_name', label: 'ชื่อเต็ม', type: 'text' },
                  { key: 'email', label: 'อีเมล', type: 'email' },
                  { key: 'phone', label: 'เบอร์โทร', type: 'tel' },
                  { key: 'position', label: 'ตำแหน่ง', type: 'text' },
                  { key: 'employee_code', label: 'รหัสพนักงาน', type: 'text' },
                  { key: 'password', label: 'รหัสผ่าน *', type: 'password' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="text-[10px] text-zinc-500 uppercase mb-1 block">{label}</label>
                    <input type={type} value={(newData as any)[key] || ''}
                      onChange={e => setNewData({ ...newData, [key]: e.target.value })}
                      className={FIELD_CLS} />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Role</label>
                  <select value={newData.role} onChange={e => setNewData({ ...newData, role: e.target.value as any })} className={FIELD_CLS}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <button onClick={handleCreate}
                className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 rounded-xl text-xs uppercase hover:bg-gold/90">
                <Plus className="w-4 h-4" /> สร้างพนักงาน
              </button>
            </div>
          )}

          {/* Employee detail */}
          {selectedEmployee && !showCreate ? (
            <div className="glass-card p-8 rounded-3xl gold-border-glow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  {selectedEmployee.avatar_url
                    ? <img src={selectedEmployee.avatar_url} alt="" className="w-16 h-16 rounded-2xl" />
                    : <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                        <span className="text-2xl font-black text-[#c4982f]">{selectedEmployee.nickname[0]}</span>
                      </div>
                  }
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{selectedEmployee.nickname}</h3>
                    <p className="text-sm text-zinc-500">{selectedEmployee.position || 'ไม่ระบุตำแหน่ง'}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${
                      selectedEmployee.role === 'super_admin' ? 'bg-gold/10 text-gold border border-gold/30'
                      : selectedEmployee.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-zinc-800 text-zinc-500'
                    }`}>{selectedEmployee.role}</span>
                  </div>
                </div>
                {isSuperAdmin && !isEditing && (
                  <button onClick={() => setIsEditing(true)}
                    className="p-3 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold transition border border-gold/20">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {[
                  { icon: Code, key: 'employee_code', label: 'รหัสพนักงาน', type: 'text' },
                  { icon: User, key: 'full_name', label: 'ชื่อเต็ม', type: 'text' },
                  { icon: Mail, key: 'email', label: 'อีเมล', type: 'email' },
                  { icon: Phone, key: 'phone', label: 'เบอร์โทร', type: 'tel', highlight: true },
                  { icon: User, key: 'position', label: 'ตำแหน่ง', type: 'text' },
                  { icon: Calendar, key: 'birthday', label: 'วันเกิด', type: 'date' },
                ].map(({ icon: Icon, key, label, type, highlight }) => (
                  <div key={key} className={`flex items-start gap-3 p-4 rounded-2xl border ${highlight ? 'border-gold/20 bg-gold/5' : 'border-zinc-900 bg-zinc-950/30'}`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-gold/70' : 'text-zinc-500'}`} />
                    <div className="flex-1">
                      <label className={`text-[10px] uppercase tracking-widest block mb-1 ${highlight ? 'text-gold/70' : 'text-zinc-500'}`}>{label}</label>
                      {isEditing ? (
                        <input type={type} value={(editData as any)[key] || ''}
                          onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                          className={FIELD_CLS} />
                      ) : (
                        <p className="text-sm font-semibold text-zinc-200">
                          {key === 'birthday' && (editData as any)[key]
                            ? new Date((editData as any)[key]).toLocaleDateString('th-TH')
                            : (editData as any)[key] || '-'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Start date (read-only) */}
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-900 bg-zinc-950/30">
                  <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">วันเริ่มงาน</label>
                    <p className="text-sm font-semibold text-zinc-200">
                      {selectedEmployee.start_date ? new Date(selectedEmployee.start_date).toLocaleDateString('th-TH') : '-'}
                    </p>
                  </div>
                </div>

                {/* Role (super_admin edit) */}
                {isEditing && isSuperAdmin && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-900 bg-zinc-950/30">
                    <User className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Role</label>
                      <select value={editData.role || 'user'} onChange={e => setEditData({ ...editData, role: e.target.value as any })} className={FIELD_CLS}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-3 mt-6">
                  <button onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gold text-black font-bold rounded-2xl text-xs uppercase hover:bg-gold/90">
                    <Save className="w-4 h-4" /> บันทึก
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditData(selectedEmployee); }}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 text-zinc-300 font-bold rounded-2xl text-xs uppercase hover:bg-zinc-700">
                    <X className="w-4 h-4" /> ยกเลิก
                  </button>
                </div>
              )}
            </div>
          ) : !showCreate ? (
            <div className="glass-card rounded-3xl gold-border-glow flex items-center justify-center min-h-[400px] text-center">
              <div className="text-zinc-600">
                <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">เลือกพนักงานเพื่อดูรายละเอียด</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-8 rounded-3xl gold-border-glow max-w-sm w-full text-center space-y-4">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-100">ยืนยันการลบ</h3>
            <p className="text-sm text-zinc-400">การลบพนักงานไม่สามารถย้อนกลับได้</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-xs uppercase">ลบเลย</button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl text-xs uppercase">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
