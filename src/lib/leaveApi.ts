import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { LeaveRequest } from './attendanceApi';

function configured() {
  if (!isSupabaseConfigured) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function listPendingLeaves(): Promise<LeaveRequest[]> {
  configured();
  const rows: LeaveRequest[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('leave_requests').select('*').eq('status', 'pending')
      .order('leave_date').order('id').range(offset, offset + 499);
    check(error);
    rows.push(...((data || []) as LeaveRequest[]));
    if (!data || data.length < 500) return rows;
  }
}
export async function decideLeave(id: string, status: 'approved' | 'rejected', note: string) {
  configured();
  const { data, error } = await supabase.from('leave_requests').update({
    status, manager_note: note.trim() || null, approved_at: status === 'approved' ? new Date().toISOString() : null,
  }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  check(error);
  if (!data) throw new Error('ใบลานี้ถูกจัดการแล้ว กรุณารีเฟรชรายการ');
}
