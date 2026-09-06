import { useState, type FormEvent } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function Login({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (await login(email, password)) onLoginSuccess?.();
      else setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อได้');
    } finally { setBusy(false); setPassword(''); }
  }
  return (
    <form onSubmit={submit} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 space-y-5">
      <Lock className="h-6 w-6 text-gold" />
      <h2 className="text-xl font-semibold">เข้าสู่ระบบ มหานิยม 999</h2>
      <label className="block space-y-2"><span>อีเมล</span>
        <input autoFocus required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border p-3" />
      </label>
      <label className="block space-y-2"><span>รหัสผ่าน</span>
        <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border p-3" />
      </label>
      {!isSupabaseConfigured && <p role="alert">ยังไม่ได้เชื่อมต่อระบบเข้าสู่ระบบ</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={busy || !isSupabaseConfigured} className="flex w-full items-center justify-center gap-2 rounded bg-[var(--app-accent)] px-4 py-3 text-white disabled:opacity-50">
        <LogIn className="h-4 w-4" />{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
