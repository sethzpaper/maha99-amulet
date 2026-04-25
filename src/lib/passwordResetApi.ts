import { supabase, isSupabaseConfigured } from './supabaseClient';

export type ResetStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PasswordResetRequest {
  id: string;
  employee_code: string;
  user_name?: string | null;
  reason?: string | null;
  status: ResetStatus;
  approved_by?: string | null;
  approver_note?: string | null;
  approved_at?: string | null;
  created_at: string;
}

function ensure() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
}

/** ผู้ใช้ขอรีเซ็ตรหัสผ่าน — เรียกจากหน้า Login (ไม่ต้อง login ก่อน) */
export async function requestPasswordReset(employeeCode: string, reason?: string): Promise<string> {
  ensure();
  const { data, error } = await supabase.rpc('request_password_reset', {
    p_code: employeeCode.trim(),
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message || 'request failed');
  return data as string;
}

/** Admin: ดู requests ทั้งหมด (filter ด้วย status ได้) */
export async function listResetRequests(status?: ResetStatus): Promise<PasswordResetRequest[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let q = supabase
      .from('password_reset_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as PasswordResetRequest[];
  } catch (err) {
    console.warn('listResetRequests error:', err);
    return [];
  }
}

/** Admin: อนุมัติ + ตั้งรหัสใหม่ */
export async function approveResetRequest(params: {
  requestId: string;
  newPassword: string;
  approverName: string;
  note?: string;
}): Promise<void> {
  ensure();
  const { error } = await supabase.rpc('approve_password_reset', {
    p_request_id: params.requestId,
    p_new_password: params.newPassword,
    p_approver: params.approverName,
    p_note: params.note ?? null,
  });
  if (error) throw new Error(error.message || 'approve failed');
}

/** Admin: ปฏิเสธคำขอ */
export async function rejectResetRequest(params: {
  requestId: string;
  approverName: string;
  note?: string;
}): Promise<void> {
  ensure();
  const { error } = await supabase.rpc('reject_password_reset', {
    p_request_id: params.requestId,
    p_approver: params.approverName,
    p_note: params.note ?? null,
  });
  if (error) throw new Error(error.message || 'reject failed');
}
