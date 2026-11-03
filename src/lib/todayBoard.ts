import type { LeaveRequest, TimeEntry } from './attendanceApi';

export interface FeedItem {
  id: string;
  userId: string;
  name: string;
  action: 'check_in' | 'check_out';
  at: string;
  status: TimeEntry['status'];
}

export interface TodaySummary {
  total: number;
  present: number;
  checkedOut: number;
  onLeave: number;
  notYet: number;
}

/** รายการเหตุการณ์ลงเวลาวันนี้ ล่าสุดอยู่บนสุด (เข้างานและออกงานแยกเป็นคนละรายการ) */
export function buildTodayFeed(entries: TimeEntry[], today: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of entries) {
    if (entry.work_date !== today) continue;
    if (entry.check_in_time) items.push({ id: entry.id + ':in', userId: entry.user_id, name: entry.user_name, action: 'check_in', at: entry.check_in_time, status: entry.status });
    if (entry.check_out_time) items.push({ id: entry.id + ':out', userId: entry.user_id, name: entry.user_name, action: 'check_out', at: entry.check_out_time, status: entry.status });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** สรุปสถานะวันนี้; คนที่ลาแต่มีสแกนเข้างาน นับเป็นมาทำงาน */
export function summarizeToday(entries: TimeEntry[], leaves: LeaveRequest[], activeEmployeeIds: string[], today: string): TodaySummary {
  const todays = entries.filter((entry) => entry.work_date === today);
  const scanned = new Set(todays.filter((entry) => entry.check_in_time).map((entry) => entry.user_id));
  const checkedOut = new Set(todays.filter((entry) => entry.check_out_time).map((entry) => entry.user_id));
  const leaveIds = new Set([
    ...leaves.filter((leave) => leave.leave_date === today && leave.status === 'approved').map((leave) => leave.user_id),
    ...todays.filter((entry) => entry.status === 'leave' || entry.status === 'auto-leave').map((entry) => entry.user_id),
  ].filter((id) => !scanned.has(id)));
  const total = Math.max(activeEmployeeIds.length, new Set([...scanned, ...leaveIds]).size);
  return {
    total,
    present: scanned.size,
    checkedOut: checkedOut.size,
    onLeave: leaveIds.size,
    notYet: Math.max(0, total - scanned.size - leaveIds.size),
  };
}
