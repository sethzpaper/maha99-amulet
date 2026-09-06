import { supabase, isSupabaseConfigured } from './supabaseClient';
import { validateVideo, type Assignee, type WorkflowVideo } from './workflow';
import type { LeaveRequest } from './attendanceApi';
import { dataService } from './dataService';
import { todayBangkok } from './workflow';

function configured() {
  if (!isSupabaseConfigured) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (['42703', 'PGRST204'].includes(error.code || '')) throw new Error('ยังไม่ได้ติดตั้งข้อมูลบอร์ดวิดีโอ กรุณารัน migration ของ workflow');
  throw new Error(error.message);
}
const columns = 'id,entryDate,fileName,productName,productImage,driveLink,creator,isPostedFB,isPostedTT,workflow_status,assignee_id,due_date,brief,workflow_version';
async function readPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await page(offset, offset + 499);
    check(error);
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export async function listWorkflow(): Promise<WorkflowVideo[]> {
  configured();
  return readPages<WorkflowVideo>((from, to) => supabase.from('videos').select(columns).order('due_date', { ascending: true, nullsFirst: false }).order('id').range(from, to));
}
export async function listAssignees(): Promise<Assignee[]> {
  configured();
  return readPages<Assignee>((from, to) => supabase.from('employees').select('id,nickname,is_active').order('nickname').order('id').range(from, to));
}
export type VideoDraft = Pick<WorkflowVideo, 'fileName' | 'productName' | 'driveLink' | 'workflow_status' | 'assignee_id' | 'due_date' | 'brief'>;
export async function saveWorkflow(draft: VideoDraft, previous?: WorkflowVideo) {
  configured();
  validateVideo(draft, previous?.workflow_status);
  if (!previous && draft.workflow_status !== 'idea') throw new Error('งานใหม่ต้องเริ่มจากไอเดีย');
  const payload = { ...draft, fileName: draft.fileName.trim() };
  const query = previous
    ? supabase.from('videos').update(payload).eq('id', previous.id).eq('workflow_version', previous.workflow_version)
    : supabase.from('videos').insert({ ...payload, entryDate: todayBangkok() });
  const { data, error } = await query.select(columns).maybeSingle();
  check(error);
  if (!data) throw new Error('รายการถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาปิดหน้าต่างและรีเฟรชก่อนแก้ไข');
  dataService.invalidateVideos();
  return data as WorkflowVideo;
}
export async function listPendingLeaves(): Promise<LeaveRequest[]> {
  configured();
  return readPages<LeaveRequest>((from, to) => supabase.from('leave_requests').select('*').eq('status', 'pending').order('leave_date').order('id').range(from, to));
}
export async function decideLeave(id: string, status: 'approved' | 'rejected', note: string) {
  configured();
  const { data, error } = await supabase.from('leave_requests').update({
    status, manager_note: note.trim() || null, approved_at: status === 'approved' ? new Date().toISOString() : null,
  }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  check(error);
  if (!data) throw new Error('ใบลานี้ถูกจัดการแล้ว กรุณารีเฟรชรายการ');
}
