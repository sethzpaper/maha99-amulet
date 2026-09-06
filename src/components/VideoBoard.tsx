import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search, UserRound, CalendarDays, ExternalLink } from 'lucide-react';
import { listWorkflow, listAssignees } from '../lib/workflowApi';
import { displayDate, overdue, dueToday, stages, type WorkflowStatus, type WorkflowVideo, type Assignee } from '../lib/workflow';
import { VideoEditor } from './VideoEditor';
import { useWorkDate } from '../lib/useWorkDate';

export function VideoBoard({ initialStage }: { initialStage?: WorkflowStatus }) {
  const today = useWorkDate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<WorkflowVideo[]>([]);
  const [people, setPeople] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [stage, setStage] = useState(initialStage || '');
  const [deadline, setDeadline] = useState('');
  useEffect(() => { setStage(initialStage || ''); }, [initialStage]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [videos, assignees] = await Promise.all([listWorkflow(), listAssignees()]); setRows(videos); setPeople(assignees); }
    catch (error) { setError(error instanceof Error ? error.message : 'โหลดงานไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const taskId = params.get('task');
  const selected = rows.find((row) => row.id === taskId);
  function open(id: string) { setParams((current) => { const next = new URLSearchParams(current); next.set('task', id); return next; }); }
  function close() { setParams((current) => { const next = new URLSearchParams(current); next.delete('task'); return next; }, { replace: true }); }
  const filtered = rows.filter((row) => (!owner || (owner === 'unassigned' ? !row.assignee_id : row.assignee_id === owner))
    && (!stage || row.workflow_status === stage)
    && (!deadline || (deadline === 'overdue' ? overdue(row, today) : dueToday(row, today)))
    && [row.fileName, row.productName, row.brief].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return (
    <section aria-label="บอร์ดงานวิดีโอ" className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">งานวิดีโอ</h2>
        <div className="flex gap-2">
          <button title="รีเฟรชงาน" aria-label="รีเฟรชงาน" className="work-icon" disabled={loading} onClick={load}><RefreshCw size={18} /></button>
          <button className="work-button work-primary" disabled={loading || !!error} onClick={() => open('new')}><Plus size={18} />เพิ่มไอเดีย</button>
        </div>
      </div>
      <div className="work-filters">
        <label className="work-search"><Search size={17} /><input aria-label="ค้นหางานวิดีโอ" placeholder="ค้นหางานหรือสินค้า" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <select aria-label="กรองผู้รับผิดชอบ" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">ผู้รับผิดชอบทั้งหมด</option><option value="unassigned">ยังไม่มอบหมาย</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select>
        <select aria-label="กรองสถานะ" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">ทุกขั้นตอน</option>{stages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select aria-label="กรองกำหนดส่ง" value={deadline} onChange={(e) => setDeadline(e.target.value)}><option value="">กำหนดส่งทั้งหมด</option><option value="today">ครบกำหนดวันนี้</option><option value="overdue">เลยกำหนด</option></select>
      </div>
      {message && <p role="status" className="text-emerald-300 text-sm">{message}</p>}
      {error ? <p role="alert" className="text-red-400 py-4">{error}</p> : loading ? <p role="status">กำลังโหลดงาน...</p> : (
        <div className="workflow-board">
          {stages.filter((item) => !stage || stage === item.id).map((item) => {
            const tasks = filtered.filter((row) => row.workflow_status === item.id);
            return <section key={item.id} className="workflow-column" aria-label={item.label}>
              <div className="flex justify-between items-center border-b border-[var(--app-border)] pb-3 mb-3"><h3 className="font-semibold text-sm">{item.label}</h3><span className="text-sm tabular-nums text-[var(--app-text-muted)]">{tasks.length}</span></div>
              {tasks.length === 0 && <p className="text-sm text-[var(--app-text-muted)] py-5">ไม่มีงาน</p>}
              <div className="space-y-3">{tasks.map((row) => <article key={row.id} className="workflow-task">
                <button className="text-left font-semibold text-sm hover:text-gold break-words w-full" onClick={() => open(row.id)}>{row.fileName || 'งานไม่มีชื่อ'}</button>
                {row.productName && <p className="text-xs text-[var(--app-text-muted)] mt-1 break-words">{row.productName}</p>}
                <p className="flex items-center gap-2 text-xs mt-4"><UserRound size={14} className="shrink-0" />{people.find((person) => person.id === row.assignee_id)?.nickname || 'ยังไม่มอบหมาย'}</p>
                <p className={`flex items-center gap-2 text-xs mt-2 ${overdue(row) ? 'text-red-400' : 'text-[var(--app-text-muted)]'}`}><CalendarDays size={14} className="shrink-0" />{displayDate(row.due_date)}{overdue(row) ? ' · เลยกำหนด' : ''}</p>
                {row.driveLink && /^https?:\/\//i.test(row.driveLink) && <a href={row.driveLink} target="_blank" rel="noreferrer" className="inline-flex gap-1 items-center text-xs text-gold mt-3"><ExternalLink size={13} />เปิดวิดีโอ</a>}
              </article>)}</div>
            </section>;
          })}
        </div>
      )}
      {!loading && !error && taskId && taskId !== 'new' && !selected && <p role="alert">ไม่พบงานนี้ <button className="text-gold" onClick={close}>ปิด</button></p>}
      {!loading && !error && (taskId === 'new' || selected) && <VideoEditor key={selected ? selected.id + selected.workflow_version : 'new'} video={selected} assignees={people} onClose={close} onSaved={(saved) => {
        setRows((current) => current.some((row) => row.id === saved.id) ? current.map((row) => row.id === saved.id ? saved : row) : [...current, saved]);
        setMessage('บันทึกงานแล้ว'); close();
      }} />}
    </section>
  );
}
