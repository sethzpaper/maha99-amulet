import { useState, useEffect } from 'react';
import { listEmployees, getEmployee, updateEmployee, Employee } from '../lib/employeeApi';
import { useAuthStore } from '../lib/authStore';
import { User, Phone, Mail, Calendar, Code, Edit2, Save, X } from 'lucide-react';

export function EmployeeList() {
  const user = useAuthStore((s) => s.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const list = await listEmployees();
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err: any) {
      showToast('error', 'โหลดรายชื่อพนักงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = async (emp: Employee) => {
    try {
      const detail = await getEmployee(emp.id);
      setSelectedEmployee(detail);
      setEditData(detail);
      setIsEditing(false);
    } catch (err: any) {
      showToast('error', 'โหลดข้อมูลพนักงานไม่สำเร็จ');
    }
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
    } catch (err: any) {
      showToast('error', err.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">รายชื่อพนักงาน</h2>
          <p className="text-xs text-slate-500 uppercase tracking-[0.2em]">Employee Information & Details</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-2xl text-sm font-semibold z-50 ${
            toast.type === 'success'
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="sticky top-20">
            <input
              type="text"
              placeholder="ค้นหาพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-slate-500">ไม่พบพนักงาน</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedEmployee?.id === emp.id
                        ? 'bg-sky-50 border-sky-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt={emp.nickname} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{emp.nickname}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.position || 'ไม่ระบุ'}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Employee Details */}
        {selectedEmployee ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  {selectedEmployee.avatar_url ? (
                    <img src={selectedEmployee.avatar_url} alt={selectedEmployee.nickname} className="w-16 h-16 rounded-2xl" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-900">{selectedEmployee.nickname}</h3>
                    <p className="text-sm text-slate-500">{selectedEmployee.position || 'ไม่ระบุตำแหน่ง'}</p>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {/* Employee Code */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <Code className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">รหัสพนักงาน</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.employee_code || ''}
                        onChange={(e) => setEditData({ ...editData, employee_code: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.employee_code || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Full Name */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <User className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">ชื่อเต็ม</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.full_name || ''}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.full_name || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <Mail className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">อีเมล</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.email || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-sky-200 bg-sky-50">
                  <Phone className="w-5 h-5 text-sky-600 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-sky-600 uppercase tracking-widest block mb-2">เบอร์โทรศัพท์</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        placeholder="เช่น 08x-xxxx-xxxx"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.phone || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Position */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <User className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">ตำแหน่ง</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.position || ''}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.position || '-'}</p>
                    )}
                  </div>
                </div>

                {/* Birthday */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <Calendar className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">วันเกิด</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.birthday || ''}
                        onChange={(e) => setEditData({ ...editData, birthday: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString('th-TH') : '-'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <Calendar className="w-5 h-5 text-slate-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">วันเริ่มงาน</label>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedEmployee.start_date ? new Date(selectedEmployee.start_date).toLocaleDateString('th-TH') : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition"
                  >
                    <Save className="w-4 h-4" />
                    บันทึก
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditData(selectedEmployee);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl transition"
                  >
                    <X className="w-4 h-4" />
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex items-center justify-center min-h-[400px] text-center">
            <div className="text-slate-500">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>เลือกพนักงานเพื่อดูรายละเอียด</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
