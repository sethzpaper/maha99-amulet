const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

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

const TRACKED_ACCOUNTS_STORAGE_KEY = 'amulet_tracked_accounts';

const defaultTrackedAccounts: TrackedAccount[] = [
  {
    id: 'local-facebook-owned',
    platform: 'facebook',
    account_name: 'มหานิยม999 Fanpage',
    account_url: 'https://facebook.com/mahaniyom999',
    account_handle: '@mahaniyom999',
    is_active: true,
    is_competitor: false,
    note: 'เพจหลักที่ใช้แสดงกราฟ',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-tiktok-owned',
    platform: 'tiktok',
    account_name: 'มหานิยม999 TikTok',
    account_url: 'https://www.tiktok.com/@mahaniyom999',
    account_handle: '@mahaniyom999',
    is_active: true,
    is_competitor: false,
    note: 'ช่องหลักที่ใช้แสดงกราฟ',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-facebook-competitor',
    platform: 'facebook',
    account_name: 'คู่แข่ง Facebook ตัวอย่าง',
    account_url: 'https://facebook.com/competitor-page',
    account_handle: '@competitor',
    is_active: true,
    is_competitor: true,
    note: 'ใช้เปรียบเทียบในหน้า Competitor',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-tiktok-competitor',
    platform: 'tiktok',
    account_name: 'คู่แข่ง TikTok ตัวอย่าง',
    account_url: 'https://www.tiktok.com/@competitor',
    account_handle: '@competitor',
    is_active: true,
    is_competitor: true,
    note: 'ใช้เปรียบเทียบในหน้า Competitor',
    created_at: new Date().toISOString(),
  },
];

function readLocalTrackedAccounts(): TrackedAccount[] {
  if (typeof window === 'undefined') return defaultTrackedAccounts;

  try {
    const saved = window.localStorage.getItem(TRACKED_ACCOUNTS_STORAGE_KEY);
    if (!saved) {
      window.localStorage.setItem(TRACKED_ACCOUNTS_STORAGE_KEY, JSON.stringify(defaultTrackedAccounts));
      return defaultTrackedAccounts;
    }
    return JSON.parse(saved);
  } catch {
    return defaultTrackedAccounts;
  }
}

function writeLocalTrackedAccounts(accounts: TrackedAccount[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TRACKED_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function filterTrackedAccounts(
  accounts: TrackedAccount[],
  params: { platform?: 'facebook' | 'tiktok'; competitor?: boolean } = {},
) {
  return accounts.filter((account) => {
    if (params.platform && account.platform !== params.platform) return false;
    if (params.competitor !== undefined && account.is_competitor !== params.competitor) return false;
    return account.is_active;
  });
}

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
  try {
    const res = await fetch(`${API_BASE}/tracked-accounts?${qs.toString()}`);
    if (!res.ok) throw new Error('tracked accounts api failed');
    return res.json();
  } catch {
    return filterTrackedAccounts(readLocalTrackedAccounts(), params);
  }
}

export async function createTrackedAccount(role: string, body: Partial<TrackedAccount>) {
  try {
    const res = await fetch(`${API_BASE}/tracked-accounts`, {
      method: 'POST',
      headers: authHeaders(role),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'create failed');
    return res.json();
  } catch {
    const accounts = readLocalTrackedAccounts();
    const account: TrackedAccount = {
      id: `local-${Date.now()}`,
      platform: body.platform || 'facebook',
      account_name: body.account_name || 'Untitled account',
      account_url: body.account_url || '#',
      account_handle: body.account_handle,
      is_active: true,
      is_competitor: Boolean(body.is_competitor),
      note: body.note,
      created_at: new Date().toISOString(),
    };
    writeLocalTrackedAccounts([...accounts, account]);
    return account;
  }
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
  try {
    const res = await fetch(`${API_BASE}/tracked-accounts/${id}`, {
      method: 'DELETE',
      headers: authHeaders(role),
    });
    if (!res.ok) throw new Error('delete failed');
    return res.json();
  } catch {
    const accounts = readLocalTrackedAccounts().filter((account) => account.id !== id);
    writeLocalTrackedAccounts(accounts);
    return { ok: true };
  }
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
