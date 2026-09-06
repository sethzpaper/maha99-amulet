import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { WorkDialog } from './WorkDialog';
import { saveWorkflow, type VideoDraft } from '../lib/workflowApi';
import { stages, transitions, type Assignee, type WorkflowVideo } from '../lib/workflow';

export function VideoEditor({ video, assignees, onClose, onSaved }: {
  video?: WorkflowVideo; assignees: Assignee[]; onClose: () => void; onSaved: (video: WorkflowVideo) => void;
}) {
  const [draft, setDraft] = useState<VideoDraft>({
    fileName: video?.fileName || '', productName: video?.productName || '', driveLink: video?.driveLink || '',
    workflow_status: video?.workflow_status || 'idea', assignee_id: video?.assignee_id || null,
    due_date: video?.due_date || null, brief: video?.brief || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { onSaved(await saveWorkflow(draft, video)); }
    catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return (
    <WorkDialog title={video ? 'จัดการงานวิดีโอ' : 'เพิ่มไอเดีย'} busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="work-field">ชื่องาน<input autoFocus required maxLength={200} value={draft.fileName} onChange={(e) => setDraft({ ...draft, fileName: e.target.value })} /></label>
          <label className="work-field">สินค้า<input maxLength={200} value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} /></label>
          <label className="work-field">รายละเอียด<textarea rows={3} maxLength={10000} value={draft.brief} onChange={(e) => setDraft({ ...draft, brief: e.target.value })} /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="work-field">ผู้รับผิดชอบ<select aria-label="ผู้รับผิดชอบ" required={draft.workflow_status !== 'idea'} value={draft.assignee_id || ''} onChange={(e) => setDraft({ ...draft, assignee_id: e.target.value || null })}>
              <option value="">ยังไม่มอบหมาย</option>
              {assignees.map((person) => <option key={person.id} value={person.id} disabled={!person.is_active && person.id !== video?.assignee_id}>{person.nickname}{!person.is_active ? ' (ไม่ใช้งาน)' : ''}</option>)}
            </select></label>
            <label className="work-field">กำหนดส่ง<input type="date" required={draft.workflow_status !== 'idea'} value={draft.due_date || ''} onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })} /></label>
          </div>
          <label className="work-field">สถานะ<select aria-label="สถานะ" value={draft.workflow_status} onChange={(e) => setDraft({ ...draft, workflow_status: e.target.value as VideoDraft['workflow_status'] })}>
            {stages.filter((stage) => video ? stage.id === video.workflow_status || transitions[video.workflow_status].includes(stage.id) : stage.id === 'idea').map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select></label>
          <label className="work-field">ลิงก์วิดีโอ<input type="url" placeholder="https://" value={draft.driveLink} onChange={(e) => setDraft({ ...draft, driveLink: e.target.value })} /></label>
        </fieldset>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-3 border-t border-[var(--app-border)]">
          <button type="button" disabled={busy} onClick={onClose} className="work-button">ยกเลิก</button>
          <button disabled={busy} className="work-button work-primary"><Save size={16} />{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </form>
    </WorkDialog>
  );
}
