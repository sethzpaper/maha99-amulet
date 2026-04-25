import { supabase, isSupabaseConfigured } from './supabaseClient';

export type ActivityType = 'create' | 'update' | 'delete' | 'system';

export interface ActivityLogRow {
  id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  details?: string | null;
  type: ActivityType;
  ref_table?: string | null;
  ref_id?: string | null;
  created_at: string;
}

/**
 * บันทึกกิจกรรม (best-effort — ถ้า table ยังไม่มีจะไม่ throw)
 */
export async function logActivity(params: {
  userId?: string;
  userName: string;
  action: string;
  details?: string;
  type?: ActivityType;
  refTable?: string;
  refId?: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('activity_logs').insert({
      user_id: params.userId ?? null,
      user_name: params.userName,
      action: params.action,
      details: params.details ?? null,
      type: params.type ?? 'update',
      ref_table: params.refTable ?? null,
      ref_id: params.refId ?? null,
    });
  } catch (err) {
    console.warn('logActivity error:', err);
  }
}

/**
 * ดึงรายการกิจกรรมล่าสุด — ถ้า table ยังไม่ถูกสร้างจะคืน []
 */
export async function listActivityLogs(limit = 50): Promise<ActivityLogRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('listActivityLogs error:', error.message);
      return [];
    }
    return (data || []) as ActivityLogRow[];
  } catch (err) {
    console.warn('listActivityLogs exception:', err);
    return [];
  }
}

/** Helper สำหรับแสดงเวลาแบบไทย */
export function formatActivityTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    });
  } catch {
    return iso;
  }
}
