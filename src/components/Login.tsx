import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/authStore';
import { listEmployees, Employee } from '../lib/employeeApi';
import { Lock, LogIn, AlertCircle, Github, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<'employee' | 'admin'>('employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const loginEmployee = useAuthStore((s) => s.loginEmployee);
  const signInWithGitHub = useAuthStore((s) => s.signInWithGitHub);

  const githubEnabled = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    listEmployees()
      .then((list) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setEmployees([]));
  }, []);

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await loginEmployee(employeeId, password);
    setIsLoading(false);
    if (result.ok) {
      setPassword('');
      onLoginSuccess?.();
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      setPassword('');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const success = await login(username, password);
    setIsLoading(false);
    if (success) {
      setUsername('');
      setPassword('');
      onLoginSuccess?.();
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setPassword('');
    }
  };

  const handleGitHubLogin = async () => {
    setError('');
    setIsLoading(true);
    const errorMessage = await signInWithGitHub();
    setIsLoading(false);
    if (errorMessage) setError(errorMessage);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-sky-100 rounded-3xl flex items-center justify-center border border-sky-200">
                <Lock className="w-8 h-8 text-sky-700" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">Maha99 Amulet</h1>
            <p className="text-sm text-slate-500">เข้าสู่ระบบพนักงาน</p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl mb-4">
            <button
              onClick={() => {
                setMode('employee');
                setError('');
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === 'employee' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              พนักงาน
            </button>
            <button
              onClick={() => {
                setMode('admin');
                setError('');
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === 'admin' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              Admin
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

          {/* ======= EMPLOYEE LOGIN ======= */}
          {mode === 'employee' && (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  เลือกพนักงาน
                </label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all appearance-none"
                    disabled={isLoading}
                  >
                    <option value="">-- เลือกชื่อของคุณ --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nickname} {e.full_name ? `(${e.full_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedEmployee && (
                <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-100 rounded-2xl">
                  {selectedEmployee.avatar_url ? (
                    <img
                      src={selectedEmployee.avatar_url}
                      alt={selectedEmployee.nickname}
                      className="w-12 h-12 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-lg">
                      {selectedEmployee.nickname[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-base font-bold text-slate-900">{selectedEmployee.nickname}</p>
                    <p className="text-xs text-slate-500">{selectedEmployee.position || '-'}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={isLoading || !employeeId || !password}
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
          )}

          {/* ======= ADMIN LOGIN ======= */}
          {mode === 'admin' && (
            <>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    ชื่อผู้ใช้
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin หรือ อีเมล"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    รหัสผ่าน
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 rounded-2xl flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" /> Admin Sign In
                </button>
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGitHubLogin}
                  disabled={!githubEnabled || isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-60"
                >
                  <Github className="w-5 h-5 text-slate-700" />
                  {githubEnabled ? 'GitHub Sign In' : 'GitHub ไม่พร้อมใช้งาน'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
