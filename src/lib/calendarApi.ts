import { supabase, isSupabaseConfigured } from './supabaseClient';

export type EventKind = 'religious' | 'live' | 'other';

export interface CalendarEvent {
  id: string;
  event_date: string;
  title: string;
  kind: EventKind;
  needs_live: boolean;
  start_time: string | null;
  location: string | null;
  note: string | null;
  updated_at?: string;
}

export type EventDraft = Omit<CalendarEvent, 'id' | 'updated_at'> & { id?: string };

export const KIND_LABEL: Record<EventKind, string> = {
  religious: 'วันสำคัญทางศาสนา',
  live: 'ไลฟ์',
  other: 'อื่น ๆ',
};

function configured() {
  if (!isSupabaseConfigured) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
}

/** วันแรกถึงวันสุดท้ายที่ปฏิทินเดือนนั้นแสดง (รวมวันของเดือนข้างเคียงในสัปดาห์แรก/สุดท้าย) */
export function monthGrid(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  // drop the last week if it belongs entirely to the next month
  return days.slice(35, 42).every((d) => !d.startsWith(month)) ? days.slice(0, 35) : days;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const e of events) (map[e.event_date] ||= []).push(e);
  for (const list of Object.values(map)) list.sort((a, b) => (a.start_time || '99').localeCompare(b.start_time || '99'));
  return map;
}

export async function listEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('calendar_events').select('*')
    .gte('event_date', from).lte('event_date', to).order('event_date').order('start_time', { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data || []) as CalendarEvent[];
}

export async function upcomingEvents(today: string, limit = 4): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('calendar_events').select('*')
    .gte('event_date', today).order('event_date').order('start_time', { nullsFirst: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as CalendarEvent[];
}

export async function saveEvent(draft: EventDraft) {
  configured();
  const { id, ...fields } = draft;
  const payload = {
    ...fields,
    title: fields.title.trim(),
    location: fields.location?.trim() || null,
    note: fields.note?.trim() || null,
    start_time: fields.start_time || null,
  };
  const { error } = id
    ? await supabase.from('calendar_events').update(payload).eq('id', id)
    : await supabase.from('calendar_events').insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(id: string) {
  configured();
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
