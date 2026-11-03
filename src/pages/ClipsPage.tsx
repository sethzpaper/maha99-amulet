import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Plus, Radio, Settings2, Trash2, X } from 'lucide-react';
import {
  buildGrid, countByEditor, deleteClip, listClips, listEditors, listPeople, monthRange, myEmployeeId,
  saveClip, setEditorColumns, type Clip, type ClipEditor,
} from '../lib/clipsApi';
import { groupByDate, listEvents, shiftMonth, type CalendarEvent } from '../lib/calendarApi';
import { listEmployees, type Employee } from '../lib/employeeApi';
import { downloadText, toCsv } from '../lib/monthlyReport';
import { todayBangkok } from '../lib/dates';
import { useAuthStore } from '../lib/authStore';
import { WorkDialog } from '../components/WorkDialog';

const stamp = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const weekday = new Intl.DateTimeFormat('th-TH', { weekday: 'short', timeZone: 'UTC' });
const monthTitle = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
};

type Draft = { id?: string; clip_date: string; editor_id: string; title: string; note: string; clip?: Clip };

export function ClipsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const today = todayBangkok();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editors, setEditors] = useState<ClipEditor[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [me, setMe] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { days, from, to } = useMemo(() => monthRange(month), [month]);
  const grid = useMemo(() => buildGrid(clips), [clips]);
  const counts = useMemo(() => countByEditor(clips), [clips]);

  const load = useCallback(async () => {
    try {
      const [eds, list, names, evs] = await Promise.all([listEditors(), listClips(month), listPeople(), listEvents(from, to).catch(() => [])]);
      setEditors(eds); setClips(list); setPeople(names); setEvents(groupByDate(evs));
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'โหลดตารางคลิปไม่สำเร็จ'); }
  }, [month, from, to]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { myEmployeeId().then(setMe); }, []);

  const canEditColumn = (editorId: string) => isAdmin || editorId === me;

  async function submit() {
    if (!draft) return;
    setBusy(true);
    try { await saveClip(draft); setDraft(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!draft?.id || !window.confirm(`ลบ "${draft.title}"?`)) return;
    setBusy(true);
    try { await deleteClip(draft.id); setDraft(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ'); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const names = Object.fromEntries(editors.map((e) => [e.id, e.nickname]));
    const rows = [...clips].sort((a, b) => a.clip_date.localeCompare(b.clip_date) || a.created_at.localeCompare(b.created_at)).map((c) => ({
      date: c.clip_date,
      editor: names[c.editor_id] || '',
      title: c.title,
      note: c.note || '',
      created: stamp.format(new Date(c.created_at)),
      updated: stamp.format(new Date(c.updated_at)),
      updated_by: (c.updated_by && people[c.updated_by]) || '',
    }));
    downloadText(`คลิป-${month}.csv`, toCsv(rows, [
      ['date', 'วันที่'], ['editor', 'ผู้ทำ'], ['title', 'ชื่อคลิป'], ['note', 'หมายเหตุ'],
      ['created', 'ลงตารางเมื่อ'], ['updated', 'แก้ไขล่าสุด'], ['updated_by', 'แก้ไขโดย'],
    ]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill-label">ตารางอัปเดตงาน</span>
          <h2 className="mt-3 text-2xl font-bold">คลิปประจำเดือน</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">ทุกช่องบันทึกเวลาที่ลงตารางและเวลาแก้ไขล่าสุดให้อัตโนมัติ · แถวสีเหลือง = วันที่ทีมต้องไลฟ์</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-pill btn-outline-lime" onClick={exportCsv} disabled={!clips.length}><Download className="h-4 w-4" />ส่งออก Excel</button>
          {isAdmin && <button className="btn-pill btn-dark" onClick={() => setColumnsOpen(true)}><Settings2 className="h-4 w-4" />ตั้งค่าผู้ทำ</button>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button className="work-icon" aria-label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <div className="text-center">
          <h3 className="text-xl font-semibold">{monthTitle(month)}</h3>
          <p className="text-xs text-[var(--app-text-muted)]">รวม {clips.length} คลิป</p>
        </div>
        <button className="work-icon" aria-label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>

      {error && !draft && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {editors.length === 0 ? (
        <div className="hr-card p-10 text-center text-sm text-[var(--app-text-muted)]">
          ยังไม่ได้กำหนดผู้ทำคลิป {isAdmin ? 'กด "ตั้งค่าผู้ทำ" เพื่อเลือกพนักงานที่จะเป็นหัวตาราง' : 'ให้แอดมินตั้งค่าผู้ทำคลิปก่อน'}
        </div>
      ) : (
        <div className="hr-card overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 w-28 border-b border-[var(--app-border-muted)] bg-[var(--forest)] px-3 text-left !text-white">วันที่</th>
                  {editors.map((e) => (
                    <th key={e.id} className="sticky top-0 z-10 border-b border-l border-[var(--app-border-muted)] bg-[var(--forest)] px-3 text-left !text-white">
                      {e.nickname} <span className="ml-1 rounded-full bg-[var(--app-accent)] px-2 text-xs text-[var(--app-on-accent)]">{counts[e.id] || 0}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((date) => {
                  const live = events[date] || [];
                  const rowTone = live.length ? 'bg-yellow-100' : date === today ? 'bg-[var(--app-accent-faint)]' : 'bg-[var(--app-surface)]';
                  return (
                    <tr key={date} className={rowTone}>
                      <th scope="row" className={`sticky left-0 z-[5] border-b border-[var(--app-border-muted)] px-3 py-2 text-left align-top font-medium ${live.length ? 'bg-yellow-200 text-[#3f3300]' : 'bg-inherit'}`}>
                        <span className="block">{Number(date.slice(8))} <span className="text-xs font-normal opacity-70">{weekday.format(new Date(date + 'T00:00:00Z'))}</span></span>
                        {live.map((ev) => <span key={ev.id} className="mt-1 flex items-center gap-1 text-[11px] font-semibold"><Radio size={11} />{ev.title}</span>)}
                      </th>
                      {editors.map((ed) => {
                        const cell = grid[date]?.[ed.id] || [];
                        const editable = canEditColumn(ed.id);
                        return (
                          <td key={ed.id} className="border-b border-l border-[var(--app-border-muted)] px-2 py-2 align-top">
                            <div className="space-y-1.5">
                              {cell.map((clip) => (
                                <button
                                  key={clip.id}
                                  disabled={!editable}
                                  onClick={() => setDraft({ id: clip.id, clip_date: clip.clip_date, editor_id: clip.editor_id, title: clip.title, note: clip.note || '', clip })}
                                  className="block w-full rounded-lg border border-[var(--app-border-muted)] bg-[var(--app-surface)] px-2 py-1.5 text-left disabled:cursor-default disabled:opacity-100"
                                >
                                  <span className="block break-words font-medium">{clip.title}</span>
                                  <span className="block text-[11px] text-[var(--app-text-muted)]">
                                    {clip.updated_at !== clip.created_at ? 'แก้ไข ' : 'ลง '}{stamp.format(new Date(clip.updated_at))}
                                  </span>
                                </button>
                              ))}
                              {editable && (
                                <button
                                  className="flex w-full items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] py-1 text-[var(--app-text-muted)] hover:border-[var(--app-accent-text)] hover:text-[var(--app-accent-text)]"
                                  aria-label={`เพิ่มคลิปของ ${ed.nickname} วันที่ ${Number(date.slice(8))}`}
                                  onClick={() => { setError(''); setDraft({ clip_date: date, editor_id: ed.id, title: '', note: '' }); }}
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {draft && (
        <WorkDialog title={draft.id ? 'แก้ไขคลิป' : 'เพิ่มคลิป'} busy={busy} onClose={() => setDraft(null)}>
          <div className="space-y-4">
            <p className="text-sm text-[var(--app-text-muted)]">
              {editors.find((e) => e.id === draft.editor_id)?.nickname} · วันที่ {Number(draft.clip_date.slice(8))} {monthTitle(draft.clip_date.slice(0, 7))}
            </p>
            <label className="work-field">ชื่อคลิป
              <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="work-field">หมายเหตุ (ไม่บังคับ)
              <textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            {draft.clip && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-[var(--app-surface-strong)] p-3 text-xs">
                <dt className="text-[var(--app-text-muted)]">ลงตาราง</dt>
                <dd>{stamp.format(new Date(draft.clip.created_at))}{draft.clip.created_by && people[draft.clip.created_by] ? ` · ${people[draft.clip.created_by]}` : ''}</dd>
                <dt className="text-[var(--app-text-muted)]">แก้ไขล่าสุด</dt>
                <dd>{stamp.format(new Date(draft.clip.updated_at))}{draft.clip.updated_by && people[draft.clip.updated_by] ? ` · ${people[draft.clip.updated_by]}` : ''}</dd>
              </dl>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-between gap-3 pt-2">
              {draft.id ? <button className="work-button text-red-600" disabled={busy} onClick={remove}><Trash2 size={16} />ลบ</button> : <span />}
              <div className="flex gap-3">
                <button className="work-button" disabled={busy} onClick={() => setDraft(null)}><X size={16} />ยกเลิก</button>
                <button className="work-button work-primary" disabled={busy || !draft.title.trim()} onClick={submit}>บันทึก</button>
              </div>
            </div>
          </div>
        </WorkDialog>
      )}

      {columnsOpen && <EditorColumnsDialog current={editors} onClose={() => setColumnsOpen(false)} onSaved={() => { setColumnsOpen(false); void load(); }} />}
    </div>
  );
}

function EditorColumnsDialog({ current, onClose, onSaved }: { current: ClipEditor[]; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [order, setOrder] = useState<string[]>(current.map((e) => e.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { listEmployees().then((list) => setEmployees(list.filter((e) => e.is_active))); }, []);
  const name = (id: string) => employees.find((e) => e.id === id)?.nickname || current.find((e) => e.id === id)?.nickname || '…';
  const move = (index: number, delta: number) => setOrder((o) => {
    const next = [...o];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  });
  async function save() {
    setBusy(true);
    try { await setEditorColumns(order, current.map((e) => e.id)); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return (
    <WorkDialog title="ผู้ทำคลิป (หัวตาราง)" busy={busy} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--app-text-muted)]">เลือกพนักงานที่เป็นคอลัมน์ของตาราง และเรียงลำดับ ผู้ทำแต่ละคนแก้ได้เฉพาะช่องของตัวเอง แอดมินแก้ได้ทุกช่อง</p>
        <ol className="space-y-2">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-xl border border-[var(--app-border-muted)] px-3 py-2">
              <span className="w-6 text-sm font-semibold text-[var(--app-text-muted)]">{i + 1}</span>
              <span className="flex-1 font-medium">{name(id)}</span>
              <button className="work-icon h-8 w-8" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
              <button className="work-icon h-8 w-8" aria-label="เลื่อนลง" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
              <button className="work-icon h-8 w-8 text-red-600" aria-label={`เอา ${name(id)} ออก`} onClick={() => setOrder((o) => o.filter((x) => x !== id))}><X size={14} /></button>
            </li>
          ))}
        </ol>
        <label className="work-field">เพิ่มผู้ทำ
          <select value="" onChange={(e) => e.target.value && setOrder((o) => [...o, e.target.value])}>
            <option value="">— เลือกพนักงาน —</option>
            {employees.filter((e) => !order.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.nickname}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button className="work-button" disabled={busy} onClick={onClose}>ยกเลิก</button>
          <button className="work-button work-primary" disabled={busy} onClick={save}>บันทึก</button>
        </div>
      </div>
    </WorkDialog>
  );
}
