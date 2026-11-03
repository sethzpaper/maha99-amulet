import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface ClipEditor { id: string; nickname: string; clip_column: number }

export interface Clip {
  id: string;
  clip_date: string;
  editor_id: string;
  title: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

function configured() {
  if (!isSupabaseConfigured) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return { from: days[0], to: days[days.length - 1], days };
}

/** จัดคลิปเป็นตาราง: grid[date][editorId] = คลิปในช่องนั้น (เก่าก่อน) */
export function buildGrid(clips: Clip[]): Record<string, Record<string, Clip[]>> {
  const grid: Record<string, Record<string, Clip[]>> = {};
  for (const c of clips) ((grid[c.clip_date] ||= {})[c.editor_id] ||= []).push(c);
  for (const row of Object.values(grid)) for (const cell of Object.values(row)) cell.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return grid;
}

export function countByEditor(clips: Clip[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of clips) counts[c.editor_id] = (counts[c.editor_id] || 0) + 1;
  return counts;
}

export async function listEditors(): Promise<ClipEditor[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('clip_editors');
  if (error) throw new Error(error.message);
  return (data || []) as ClipEditor[];
}

/** auth user id → ชื่อเล่น สำหรับแสดง "แก้ไขโดย" */
export async function listPeople(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase.rpc('clip_people');
  if (error) return {};
  return Object.fromEntries(((data || []) as { auth_user_id: string; nickname: string }[]).map((p) => [p.auth_user_id, p.nickname]));
}

export async function myEmployeeId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('employees').select('id').eq('auth_user_id', auth.user.id).maybeSingle();
  return data ? String(data.id) : null;
}

export async function listClips(month: string): Promise<Clip[]> {
  if (!isSupabaseConfigured) return [];
  const { from, to } = monthRange(month);
  const { data, error } = await supabase.from('clips').select('*').gte('clip_date', from).lte('clip_date', to).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as Clip[];
}

export async function saveClip(clip: { id?: string; clip_date: string; editor_id: string; title: string; note?: string | null }) {
  configured();
  const payload = { clip_date: clip.clip_date, editor_id: clip.editor_id, title: clip.title.trim(), note: clip.note?.trim() || null };
  if (!payload.title) throw new Error('กรอกชื่อคลิป');
  const { error } = clip.id
    ? await supabase.from('clips').update(payload).eq('id', clip.id)
    : await supabase.from('clips').insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteClip(id: string) {
  configured();
  const { error } = await supabase.from('clips').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** แอดมิน: กำหนดว่าใครเป็นคอลัมน์ของตาราง และเรียงลำดับ (ids ตามลำดับคอลัมน์) */
export async function setEditorColumns(ids: string[], previous: string[]) {
  configured();
  const removed = previous.filter((id) => !ids.includes(id));
  if (removed.length) {
    const { error } = await supabase.from('employees').update({ clip_column: null }).in('id', removed);
    if (error) throw new Error(error.message);
  }
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase.from('employees').update({ clip_column: index + 1 }).eq('id', id);
    if (error) throw new Error(error.message);
  }
}
