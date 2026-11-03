import { supabase, isSupabaseConfigured } from './supabaseClient';
import { todayBangkok } from './dates';

export interface TimeEntry {
  id: string;
  user_id: string;
  user_name: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  status: 'working' | 'out' | 'late' | 'leave' | 'auto-leave' | 'auto-out';
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
  /** employee = ลาล่วงหน้า · manager = ผู้จัดการบันทึกให้ (รวมย้อนหลัง) */
  source?: 'employee' | 'manager';
  created_at: string;
}

export interface LeaveQuota {
  used_count: number;
  remaining: number;
  allowed: boolean;
}

export const LEAVE_MONTHLY_LIMIT = 2;
export const OVERTIME_THRESHOLD_HOURS = 11;

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

/** พนักงานจองวันลาล่วงหน้า (อย่างน้อยพรุ่งนี้) → รออนุมัติ; ตรวจซ้ำที่ฐานข้อมูล (RPC request_leave) */
export async function submitLeaveRequest(params: {
  leaveDate: string;
  leaveType?: LeaveRequest['leave_type'];
  reason?: string;
}) {
  ensureConfigured();
  if (params.leaveDate <= todayBangkok()) {
    throw new Error('ต้องลาล่วงหน้าอย่างน้อย 1 วัน ถ้าลาวันนี้หรือย้อนหลัง ให้ผู้จัดการบันทึกให้');
  }
  const { data, error } = await supabase.rpc('request_leave', {
    p_date: params.leaveDate,
    p_type: params.leaveType || 'personal',
    p_reason: params.reason?.trim() || null,
  });
  if (error) throw new Error(error.message || 'submit leave failed');
  return data as LeaveRequest;
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

export async function fetchRecentCheckins(limit = 6): Promise<TimeEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('check_in_time', { ascending: false })
      .limit(limit);
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

/** ข้อมูลดิบของรายงานประจำเดือน (แอดมินเห็นทุกคน, พนักงานเห็นเฉพาะของตัวเองตาม RLS) */
export async function fetchMonthlyReportData(month: string): Promise<{
  entries: TimeEntry[];
  leaves: LeaveRequest[];
  siteNames: Record<string, string>;
}> {
  ensureConfigured();
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const [entries, leaves, sites] = await Promise.all([
    supabase.from('time_entries').select('*').gte('work_date', start).lt('work_date', nextMonth).order('work_date'),
    supabase.from('leave_requests').select('*').eq('status', 'approved').gte('leave_date', start).lt('leave_date', nextMonth),
    supabase.from('attendance_sites').select('id,name'),
  ]);
  if (entries.error) throw new Error(entries.error.message);
  if (leaves.error) throw new Error(leaves.error.message);
  const siteNames = Object.fromEntries(((sites.data || []) as { id: string; name: string }[]).map((site) => [site.id, site.name]));
  return { entries: (entries.data || []) as TimeEntry[], leaves: (leaves.data || []) as LeaveRequest[], siteNames };
}

export interface TodayBoard {
  entries: TimeEntry[];
  leaves: LeaveRequest[];
  employees: { id: string; nickname: string; is_active: boolean }[];
}

/** ข้อมูลหน้าแรก (RPC today_board): ลงเวลาวันนี้ + ใบลาที่อนุมัติวันนี้ + รายชื่อพนักงาน — พนักงานทุกคนที่ login เรียกได้ */
export async function fetchTodayBoard(): Promise<TodayBoard> {
  if (!isSupabaseConfigured) return { entries: [], leaves: [], employees: [] };
  const { data, error } = await supabase.rpc('today_board');
  if (error) throw new Error(error.message);
  const board = (data || {}) as Partial<TodayBoard>;
  return { entries: board.entries || [], leaves: board.leaves || [], employees: board.employees || [] };
}

/** ผู้จัดการบันทึกวันลาให้พนักงาน ใช้ได้ทั้งวันนี้ ล่วงหน้า และย้อนหลัง (อนุมัติทันที) */
export async function managerRecordLeave(params: {
  employeeId: string;
  leaveDate: string;
  leaveType: LeaveRequest['leave_type'];
  reason?: string;
}) {
  ensureConfigured();
  const { data, error } = await supabase.rpc('manager_record_leave', {
    p_employee_id: params.employeeId,
    p_date: params.leaveDate,
    p_type: params.leaveType,
    p_reason: params.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as LeaveRequest;
}

/** ฟังการเปลี่ยนแปลง time_entries แบบเรียลไทม์ คืนฟังก์ชันยกเลิก */
export function subscribeTimeEntries(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('time-entries-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
