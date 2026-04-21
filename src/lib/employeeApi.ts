const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

export interface Employee {
  id: string;
  employee_code?: string;
  nickname: string;
  full_name?: string;
  avatar_url?: string;
  birthday?: string;
  email?: string;
  phone?: string;
  position?: string;
  start_date?: string;
  role: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface EmployeeBadge {
  id: string;
  awarded_at: string;
  note?: string;
  badge: Badge;
}

export interface TrackedAccount {
  id: string;
  platform: 'facebook' | 'tiktok';
  account_name: string;
  account_url: string;
  account_handle?: string;
  is_active: boolean;
  is_competitor: boolean;
  note?: string;
  created_at: string;
}

const authHeaders = (role?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(role ? { 'x-role': role } : {}),
});

// ---- Employees ----
export async function listEmployees(): Promise<Employee[]> {
  const res = await fetch(`${API_BASE}/employees`);
  return res.json();
}

export async function getEmployee(id: string): Promise<Employee & { badges: EmployeeBadge[] }> {
  const res = await fetch(`${API_BASE}/employees/${id}`);
  return res.json();
}

export async function loginEmployee(employeeId: string, password: string) {
  const res = await fetch(`${API_BASE}/employees/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'login failed');
  return data;
}

export async function createEmployee(role: string, body: Partial<Employee> & { password?: string }) {
  const res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders(role),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'create failed');
  return res.json();
}

export async function updateEmployee(role: string, id: string, body: Partial<Employee> & { password?: string }) {
  const res = await fetch(`${API_BASE}/employees/${id}`, {
    method: 'PUT',
    headers: authHeaders(role),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'update failed');
  return res.json();
}

export async function deleteEmployee(role: string, id: string) {
  const res = await fetch(`${API_BASE}/employees/${id}`, {
    method: 'DELETE',
    headers: authHeaders(role),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'delete failed');
  return res.json();
}

// ---- Badges ----
export async function listBadges(): Promise<Badge[]> {
  const res = await fetch(`${API_BASE}/employees/badges/list`);
  return res.json();
}

export async function createBadge(role: string, body: Partial<Badge>) {
  const res = await fetch(`${API_BASE}/employees/badges`, {
    method: 'POST',
    headers: authHeaders(role),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'create badge failed');
  return res.json();
}

export async function deleteBadge(role: string, id: string) {
  const res = await fetch(`${API_BASE}/employees/badges/${id}`, {
    method: 'DELETE',
    headers: authHeaders(role),
  });
  return res.json();
}

export async function awardBadge(role: string, employeeId: string, badgeId: string, note?: string) {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/badges`, {
    method: 'POST',
    headers: authHeaders(role),
    body: JSON.stringify({ badgeId, note }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'award failed');
  return res.json();
}

export async function removeBadgeAward(role: string, employeeId: string, awardId: string) {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/badges/${awardId}`, {
    method: 'DELETE',
    headers: authHeaders(role),
  });
  return res.json();
}

// ---- Tracked Accounts ----
export async function listTrackedAccounts(params: { platform?: 'facebook' | 'tiktok'; competitor?: boolean } = {}): Promise<TrackedAccount[]> {
  const qs = new URLSearchParams();
  if (params.platform) qs.set('platform', params.platform);
  if (params.competitor !== undefined) qs.set('competitor', String(params.competitor));
  const res = await fetch(`${API_BASE}/tracked-accounts?${qs.toString()}`);
  return res.json();
}

export async function createTrackedAccount(role: string, body: Partial<TrackedAccount>) {
  const res = await fetch(`${API_BASE}/tracked-accounts`, {
    method: 'POST',
    headers: authHeaders(role),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'create failed');
  return res.json();
}

export async function updateTrackedAccount(role: string, id: string, body: Partial<TrackedAccount>) {
  const res = await fetch(`${API_BASE}/tracked-accounts/${id}`, {
    method: 'PUT',
    headers: authHeaders(role),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteTrackedAccount(role: string, id: string) {
  const res = await fetch(`${API_BASE}/tracked-accounts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(role),
  });
  return res.json();
}

// ---- helper ----
export function calcTenure(startDate?: string) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}
