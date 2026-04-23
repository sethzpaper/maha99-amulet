import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface TimeEntry {
  id: string;
  user_id: string;
  user_name: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_photo_url?: string;
  check_out_photo_url?: string;
  total_hours?: number;
  overtime_hours?: number;
  status: 'working' | 'out' | 'late' | 'leave' | 'auto-leave';
  note?: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  leave_date: string;
  leave_type: 'personal' | 'sick' | 'vacation' | 'other';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  manager_email?: string;
  manager_note?: string;
  approved_at?: string;
  created_at: string;
}

export interface LeaveQuota {
  used_count: number;
  remaining: number;
  allowed: boolean;
}

const STORAGE_BUCKET = 'attendance-photos';
const LEAVE_MONTHLY_LIMIT = 2;

function ensureConfigured() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
}

function todayWorkDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function uploadPhoto(userId: string, kind: 'checkin' | 'checkout', photo: Blob): Promise<string | undefined> {
  const ts = Date.now();
  const path = `${userId}/${todayWorkDate()}/${kind}-${ts}.jpg`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, photo, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    console.warn('photo upload error:', error.message);
    return undefined;
  }
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function checkIn(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  photo?: Blob;
  note?: string;
}) {
  ensureConfigured();
  const workDate = todayWorkDate();
  let photoUrl: string | undefined;
  if (params.photo) {
    photoUrl = await uploadPhoto(params.userId, 'checkin', params.photo);
  }

  // If entry exists for today, update; else insert new
  const { data: existing } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', params.userId)
    .eq('work_date', workDate)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const payload: Partial<TimeEntry> = {
    user_id: params.userId,
    user_name: params.userName,
    work_date: workDate,
    check_in_time: nowIso,
    check_in_photo_url: photoUrl,
    status: 'working',
    note: params.note,
  };

  if (existing) {
    const { data, error } = await supabase
      .from('time_entries')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase
    .from('time_entries')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function checkOut(params: {
  userId: string;
  userName: string;
  photo?: Blob;
  note?: string;
}) {
  ensureConfigured();
  const workDate = todayWorkDate();
  let photoUrl: string | undefined;
  if (params.photo) {
    photoUrl = await uploadPhoto(params.userId, 'checkout', params.photo);
  }

  const { data: existing, error: existingErr } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', params.userId)
    .eq('work_date', workDate)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (!existing) throw new Error('no check-in found for today');

  const nowIso = new Date().toISOString();
  const checkInMs = existing.check_in_time ? new Date(existing.check_in_time).getTime() : Date.now();
  const totalHours = Math.max(0, (Date.now() - checkInMs) / (1000 * 60 * 60));
  const overtimeHours = Math.max(0, totalHours - 8);

  const update: Partial<TimeEntry> = {
    check_out_time: nowIso,
    check_out_photo_url: photoUrl || existing.check_out_photo_url,
    total_hours: Number(totalHours.toFixed(2)),
    overtime_hours: Number(overtimeHours.toFixed(2)),
    status: 'out',
    note: params.note ?? existing.note,
  };

  const { data, error } = await supabase
    .from('time_entries')
    .update(update)
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchEntries(params: { userId?: string; month?: string }): Promise<TimeEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let q = supabase.from('time_entries').select('*').order('work_date', { ascending: false });
    if (params.userId) q = q.eq('user_id', params.userId);
    if (params.month) {
      // month format YYYY-MM
      const start = `${params.month}-01`;
      const [y, m] = params.month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      q = q.gte('work_date', start).lt('work_date', nextMonth);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as TimeEntry[];
  } catch (err) {
    console.warn('fetchEntries error:', err);
    return [];
  }
}

export async function submitLeaveRequest(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  leaveDate: string;
  leaveType?: 'personal' | 'sick' | 'vacation' | 'other';
  reason?: string;
  managerEmail?: string;
}) {
  ensureConfigured();
  const managerEmail =
    params.managerEmail || (import.meta.env.VITE_MANAGER_EMAIL as string) || undefined;

  const insert = {
    user_id: params.userId,
    user_name: params.userName,
    user_email: params.userEmail,
    leave_date: params.leaveDate,
    leave_type: params.leaveType || 'personal',
    reason: params.reason,
    manager_email: managerEmail,
    status: 'pending' as const,
  };
  const { data, error } = await supabase
    .from('leave_requests')
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message || 'submit leave failed');
  return data;
}

export async function fetchLeaveQuota(userId: string, date?: string): Promise<LeaveQuota> {
  if (!isSupabaseConfigured) {
    return { used_count: 0, remaining: LEAVE_MONTHLY_LIMIT, allowed: true };
  }
  try {
    const ref = date ? new Date(date) : new Date();
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 1).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, status')
      .eq('user_id', userId)
      .gte('leave_date', start)
      .lt('leave_date', end)
      .in('status', ['pending', 'approved']);
    if (error) throw new Error(error.message);
    const used = (data || []).length;
    const remaining = Math.max(0, LEAVE_MONTHLY_LIMIT - used);
    return { used_count: used, remaining, allowed: remaining > 0 };
  } catch (err) {
    console.warn('fetchLeaveQuota error:', err);
    return { used_count: 0, remaining: LEAVE_MONTHLY_LIMIT, allowed: true };
  }
}

export async function fetchLeaveRequests(params: { userId?: string; status?: string } = {}): Promise<LeaveRequest[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (params.userId) q = q.eq('user_id', params.userId);
    if (params.status) q = q.eq('status', params.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as LeaveRequest[];
  } catch (err) {
    console.warn('fetchLeaveRequests error:', err);
    return [];
  }
}

export async function fetchRecentCheckins(): Promise<TimeEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('check_in_time', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data || []) as TimeEntry[];
  } catch {
    return [];
  }
}

export async function adminUpdateEntry(
  _role: string,
  id: string,
  body: { check_in_time?: string; check_out_time?: string; status?: string; note?: string }
) {
  ensureConfigured();
  const { data, error } = await supabase
    .from('time_entries')
    .update(body)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message || 'update failed');
  return data;
}

export async function adminCreateEntry(
  _role: string,
  body: {
    userId: string;
    userName: string;
    workDate: string;
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    note?: string;
  }
) {
  ensureConfigured();
  const insert: any = {
    user_id: body.userId,
    user_name: body.userName,
    work_date: body.workDate,
    check_in_time: body.checkInTime,
    check_out_time: body.checkOutTime,
    status: body.status || 'working',
    note: body.note,
  };
  const { data, error } = await supabase
    .from('time_entries')
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message || 'create failed');
  return data;
}

export async function exportMonthlyReport(month: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  // month format YYYY-MM
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const { data: entries, error } = await supabase
    .from('time_entries')
    .select('*')
    .gte('work_date', start)
    .lt('work_date', nextMonth)
    .order('work_date', { ascending: true });
  if (error) throw new Error(error.message || 'export failed');

  const list = (entries || []) as TimeEntry[];
  // client-side aggregation per user
  const byUser = new Map<string, {
    user_id: string;
    user_name: string;
    days: number;
    total_hours: number;
    overtime_hours: number;
    late_days: number;
    leave_days: number;
  }>();
  for (const e of list) {
    const agg = byUser.get(e.user_id) || {
      user_id: e.user_id,
      user_name: e.user_name,
      days: 0,
      total_hours: 0,
      overtime_hours: 0,
      late_days: 0,
      leave_days: 0,
    };
    agg.days += 1;
    agg.total_hours += Number(e.total_hours || 0);
    agg.overtime_hours += Number(e.overtime_hours || 0);
    if (e.status === 'late') agg.late_days += 1;
    if (e.status === 'leave' || e.status === 'auto-leave') agg.leave_days += 1;
    byUser.set(e.user_id, agg);
  }

  return {
    month,
    entries: list,
    summary: Array.from(byUser.values()),
  };
}
