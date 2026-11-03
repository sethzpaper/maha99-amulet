import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { TimeEntry } from './attendanceApi';

export interface AttendanceSite {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  require_gps: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface ScanDecision {
  ok: boolean;
  reason?: string;
  action?: 'check_in' | 'check_out';
  late?: boolean;
  employee_name?: string;
  site_name?: string;
  distance_m?: number;
  check_in_time?: string;
  at?: string;
  recorded?: boolean;
}

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

const TOKEN_PATTERN = /^TD1\.[0-9a-f-]{36}\.[0-9a-f]{32}$/;

/** รับข้อความจาก QR (ลิงก์ .../scan?t=... หรือ token ตรงๆ) แล้วคืน token ถ้าเป็น QR ของ Teamday */
export function extractToken(text: string): string | null {
  const raw = text.trim();
  if (TOKEN_PATTERN.test(raw)) return raw;
  try {
    const token = new URL(raw).searchParams.get('t');
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

/** ลิงก์ที่พิมพ์ลง QR: สแกนด้วยกล้องมือถือปกติแล้วเปิดหน้า /scan ได้ทันที */
export function qrUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/scan?t=${encodeURIComponent(token)}`;
}

/** แปลงข้อความพิกัดที่คัดลอกจาก Google Maps เช่น "13.7563, 100.5018" */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const match = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function getPosition(timeoutMs = 15000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'ยังไม่ได้อนุญาตตำแหน่ง เปิดสิทธิ์ตำแหน่งให้เว็บนี้ในการตั้งค่าเบราว์เซอร์'
        : 'หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

function configured() {
  if (!isSupabaseConfigured) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
}

async function callScan(fn: 'preview_scan' | 'scan_attendance', token: string, fix: GeoFix | null): Promise<ScanDecision> {
  configured();
  const { data, error } = await supabase.rpc(fn, {
    p_token: token,
    p_lat: fix?.lat ?? null,
    p_lng: fix?.lng ?? null,
    p_accuracy: fix?.accuracy ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ScanDecision;
}

export const previewScan = (token: string, fix: GeoFix | null) => callScan('preview_scan', token, fix);
export const confirmScan = (token: string, fix: GeoFix | null) => callScan('scan_attendance', token, fix);

/** รายการลงเวลาล่าสุดของตัวเอง (RLS ให้อ่านได้เฉพาะของตัวเอง) */
export async function fetchMyRecentEntries(limit = 7): Promise<TimeEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: me } = await supabase.from('employees').select('id').eq('auth_user_id', auth.user.id).maybeSingle();
  if (!me) return [];
  const { data, error } = await supabase.from('time_entries').select('*')
    .eq('user_id', String(me.id)).order('work_date', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as TimeEntry[];
}

// ---- Sites (admin) ----
export async function listSites(): Promise<AttendanceSite[]> {
  configured();
  const { data, error } = await supabase.from('attendance_sites').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as AttendanceSite[];
}

export async function saveSite(site: Omit<AttendanceSite, 'id' | 'created_at'> & { id?: string }) {
  configured();
  const { id, ...fields } = site;
  const query = id
    ? supabase.from('attendance_sites').update(fields).eq('id', id)
    : supabase.from('attendance_sites').insert(fields);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteSite(id: string) {
  configured();
  const { error } = await supabase.from('attendance_sites').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function siteToken(id: string): Promise<string> {
  configured();
  const { data, error } = await supabase.rpc('static_site_token', { p_site: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function rotateSiteToken(id: string): Promise<string> {
  configured();
  const { data, error } = await supabase.rpc('rotate_site_secret', { p_site: id });
  if (error) throw new Error(error.message);
  return data as string;
}
