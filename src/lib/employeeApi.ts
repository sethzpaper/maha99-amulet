import { supabase, isSupabaseConfigured } from './supabaseClient';

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

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
}

// ---- Employees ----
export async function listEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('listEmployees error:', error.message);
    return [];
  }
  return (data || []) as Employee[];
}

export async function getEmployee(id: string): Promise<Employee & { badges: EmployeeBadge[] }> {
  ensureConfigured();
  const { data: employee, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const { data: badgeRows } = await supabase
    .from('employee_badges')
    .select('id, awarded_at, note, badge:badges(*)')
    .eq('employee_id', id)
    .order('awarded_at', { ascending: false });

  const badges: EmployeeBadge[] = (badgeRows || []).map((row: any) => ({
    id: row.id,
    awarded_at: row.awarded_at,
    note: row.note,
    badge: row.badge,
  }));

  return { ...(employee as Employee), badges };
}

export async function loginEmployee(employeeId: string, password: string) {
  ensureConfigured();
  const { data, error } = await supabase.rpc('employee_login', {
    p_code: employeeId,
    p_password: password,
  });
  if (error) throw new Error(error.message || 'login failed');
  // RPC returns a single row or an array with one row depending on definition
  const emp = Array.isArray(data) ? data[0] : data;
  if (!emp) throw new Error('invalid credentials');
  return { employee: emp };
}

export async function createEmployee(_role: string, body: Partial<Employee> & { password?: string }) {
  ensureConfigured();
  const { password, ...rest } = body;
  const insert: any = { ...rest };
  if (password) {
    // plaintext -> RPC can hash, but here we push raw; server-side trigger or manual seed recommended
    insert.password_hash = password;
  }
  const { data, error } = await supabase
    .from('employees')
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEmployee(_role: string, id: string, body: Partial<Employee> & { password?: string }) {
  ensureConfigured();
  const { password, ...rest } = body;
  const update: any = { ...rest };
  if (password) {
    update.password_hash = password;
  }
  const { data, error } = await supabase
    .from('employees')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEmployee(_role: string, id: string) {
  ensureConfigured();
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---- Badges ----
export async function listBadges(): Promise<Badge[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('badges').select('*').order('name');
  if (error) {
    console.warn('listBadges error:', error.message);
    return [];
  }
  return (data || []) as Badge[];
}

export async function createBadge(_role: string, body: Partial<Badge>) {
  ensureConfigured();
  const { data, error } = await supabase.from('badges').insert(body).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBadge(_role: string, id: string) {
  ensureConfigured();
  const { error } = await supabase.from('badges').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function awardBadge(_role: string, employeeId: string, badgeId: string, note?: string) {
  ensureConfigured();
  const { data, error } = await supabase
    .from('employee_badges')
    .insert({ employee_id: employeeId, badge_id: badgeId, note, awarded_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeBadgeAward(_role: string, _employeeId: string, awardId: string) {
  ensureConfigured();
  const { error } = await supabase.from('employee_badges').delete().eq('id', awardId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---- Tracked Accounts ----
export async function listTrackedAccounts(params: { platform?: 'facebook' | 'tiktok'; competitor?: boolean } = {}): Promise<TrackedAccount[]> {
  if (!isSupabaseConfigured) {
    return filterTrackedAccounts(readLocalTrackedAccounts(), params);
  }
  try {
    let q = supabase.from('tracked_accounts').select('*').eq('is_active', true);
    if (params.platform) q = q.eq('platform', params.platform);
    if (params.competitor !== undefined) q = q.eq('is_competitor', params.competitor);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return filterTrackedAccounts(readLocalTrackedAccounts(), params);
    }
    return data as TrackedAccount[];
  } catch (err) {
    console.warn('listTrackedAccounts fallback:', err);
    return filterTrackedAccounts(readLocalTrackedAccounts(), params);
  }
}

export async function createTrackedAccount(_role: string, body: Partial<TrackedAccount>) {
  try {
    ensureConfigured();
    const insert = {
      platform: body.platform || 'facebook',
      account_name: body.account_name || 'Untitled account',
      account_url: body.account_url || '#',
      account_handle: body.account_handle,
      is_active: body.is_active ?? true,
      is_competitor: Boolean(body.is_competitor),
      note: body.note,
    };
    const { data, error } = await supabase.from('tracked_accounts').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.warn('createTrackedAccount fallback:', err);
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

export async function updateTrackedAccount(_role: string, id: string, body: Partial<TrackedAccount>) {
  ensureConfigured();
  const { data, error } = await supabase
    .from('tracked_accounts')
    .update(body)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTrackedAccount(_role: string, id: string) {
  try {
    ensureConfigured();
    const { error } = await supabase.from('tracked_accounts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    console.warn('deleteTrackedAccount fallback:', err);
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
