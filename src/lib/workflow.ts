import type { VideoRecord } from '../types';

export const stages = [
  { id: 'idea', label: 'ไอเดีย' },
  { id: 'production', label: 'ผลิต' },
  { id: 'review', label: 'ตรวจ' },
  { id: 'approved', label: 'อนุมัติ' },
  { id: 'published', label: 'เผยแพร่' },
] as const;
export type WorkflowStatus = typeof stages[number]['id'];
export interface WorkflowVideo extends VideoRecord {
  workflow_status: WorkflowStatus;
  assignee_id: string | null;
  due_date: string | null;
  brief: string;
  workflow_version: number;
}
export interface Assignee { id: string; nickname: string; is_active: boolean }
export const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  idea: ['production'],
  production: ['idea', 'review'],
  review: ['production', 'approved'],
  approved: ['review', 'published'],
  published: ['production'],
};
export function todayBangkok(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)!.value).join('-');
}
export function overdue(video: WorkflowVideo, today = todayBangkok()) {
  return video.workflow_status !== 'published' && !!video.due_date && video.due_date < today;
}
export function dueToday(video: WorkflowVideo, today = todayBangkok()) {
  return video.workflow_status !== 'published' && video.due_date === today;
}
export function displayDate(date: string | null) {
  return date ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(date + 'T12:00:00+07:00')) : 'ยังไม่กำหนด';
}
export function validateVideo(video: Pick<WorkflowVideo, 'fileName' | 'workflow_status' | 'assignee_id' | 'due_date'>, previous?: WorkflowStatus) {
  if (!video.fileName.trim()) throw new Error('กรุณาระบุชื่องาน');
  if (previous && previous !== video.workflow_status && !transitions[previous].includes(video.workflow_status)) {
    throw new Error('กรุณาเปลี่ยนสถานะตามขั้นตอน');
  }
  if (video.workflow_status !== 'idea' && (!video.assignee_id || !video.due_date)) {
    throw new Error('กรุณาระบุผู้รับผิดชอบและกำหนดส่งก่อนเริ่มงาน');
  }
}
