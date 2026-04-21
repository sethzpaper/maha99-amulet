const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

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

export async function checkIn(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  photo?: Blob;
  note?: string;
}) {
  const fd = new FormData();
  fd.append('userId', params.userId);
  fd.append('userName', params.userName);
  if (params.userEmail) fd.append('userEmail', params.userEmail);
  if (params.note) fd.append('note', params.note);
  if (params.photo) fd.append('photo', params.photo, 'checkin.jpg');

  const res = await fetch(`${API_BASE}/attendance/check-in`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error((await res.json()).error || 'check-in failed');
  return res.json();
}

export async function checkOut(params: {
  userId: string;
  userName: string;
  photo?: Blob;
  note?: string;
}) {
  const fd = new FormData();
  fd.append('userId', params.userId);
  fd.append('userName', params.userName);
  if (params.note) fd.append('note', params.note);
  if (params.photo) fd.append('photo', params.photo, 'checkout.jpg');

  const res = await fetch(`${API_BASE}/attendance/check-out`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error((await res.json()).error || 'check-out failed');
  return res.json();
}

export async function fetchEntries(params: { userId?: string; month?: string }): Promise<TimeEntry[]> {
  const qs = new URLSearchParams();
  if (params.userId) qs.set('userId', params.userId);
  if (params.month) qs.set('month', params.month);
  const res = await fetch(`${API_BASE}/attendance/entries?${qs.toString()}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/leave/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'submit leave failed');
  }
  return res.json();
}

export async function fetchLeaveQuota(userId: string, date?: string): Promise<LeaveQuota> {
  const qs = new URLSearchParams({ userId });
  if (date) qs.set('date', date);
  const res = await fetch(`${API_BASE}/leave/quota?${qs.toString()}`);
  return res.json();
}

export async function fetchLeaveRequests(params: { userId?: string; status?: string } = {}): Promise<LeaveRequest[]> {
  const qs = new URLSearchParams();
  if (params.userId) qs.set('userId', params.userId);
  if (params.status) qs.set('status', params.status);
  const res = await fetch(`${API_BASE}/leave/requests?${qs.toString()}`);
  return res.json();
}

export async function exportMonthlyReport(month: string) {
  const res = await fetch(`${API_BASE}/reports/monthly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'export failed');
  return res.json();
}
