import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../lib/authStore';
import { listEmployees, Employee } from '../lib/employeeApi';
import { AlertCircle, Lock, LogIn, Phone, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess?: () => void;
}

type LoginMode = 'name' | 'phone';

const normalizePhone = (value: string) => value.replace(/\D/g, '');

export function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<LoginMode>('name');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loginEmployee = useAuthStore((s) => s.loginEmployee);

  useEffect(() => {
    listEmployees()
      .then((list) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setEmployees([]));
  }, []);

  const selectedEmployee = employees.find((employee) => employee.id === employeeId);
  const phoneMatchedEmployee = useMemo(() => {
    const current = normalizePhone(phone);
    if (!current) return undefined;
    return employees.find((employee) => normalizePhone(employee.phone || '') === current);
  }, [employees, phone]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const targetEmployeeId = mode === 'name' ? employeeId : phoneMatchedEmployee?.id;
    if (!targetEmployeeId) {
      setError(mode === 'name' ? 'กรุณาเลือกชื่อพนักงาน' : 'ไม่พบพนักงานจากเบอร์โทรนี้');
      return;
    }

    setIsLoading(true);
    const result = await loginEmployee(targetEmployeeId, password);
    setIsLoading(false);

    if (result.ok) {
      setPassword('');
      onLoginSuccess?.();
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      setPassword('');
    }
  };

  const activeEmployee = mode === 'name' ? selectedEmployee : phoneMatchedEmployee;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-sky-100 rounded-3xl flex items-center justify-center border border-sky-200">
              <Lock className="w-8 h-8 text-sky-700" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Maha99 Amulet</h1>
          <p className="text-sm text-slate-500">เข้าสู่ระบบด้วยรายชื่อหรือเบอร์โทร</p>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('name');
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === 'name' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            เลือกรายชื่อ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('phone');
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === 'phone' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            กรอกเบอร์โทร
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {mode === 'name' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                เลือกพนักงาน
              </label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all appearance-none"
                  disabled={isLoading}
                >
                  <option value="">-- เลือกชื่อของคุณ --</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.nickname} {employee.full_name ? `(${employee.full_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                เบอร์โทร
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setError('');
                  }}
                  placeholder="เช่น 0812345678"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {activeEmployee && (
            <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-100 rounded-2xl">
              {activeEmployee.avatar_url ? (
                <img src={activeEmployee.avatar_url} alt={activeEmployee.nickname} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-lg">
                  {activeEmployee.nickname[0]}
                </div>
              )}
              <div>
                <p className="text-base font-bold text-slate-900">{activeEmployee.nickname}</p>
                <p className="text-xs text-slate-500">{activeEmployee.position || activeEmployee.role}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              รหัสยืนยัน
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                disabled={isLoading}
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading || !password || (mode === 'name' ? !employeeId : !phone)}
            className="w-full mt-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>เข้าสู่ระบบ</span>
              </>
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
}
