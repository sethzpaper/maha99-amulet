import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Radio, Trash2, X } from 'lucide-react';
import {
  deleteEvent, groupByDate, KIND_LABEL, listEvents, monthGrid, saveEvent, shiftMonth,
  type CalendarEvent, type EventDraft, type EventKind,
} from '../lib/calendarApi';
import { todayBangkok, displayDate } from '../lib/dates';
import { useAuthStore } from '../lib/authStore';
import { WorkDialog } from '../components/WorkDialog';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const monthTitle = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
};
const emptyDraft = (date: string): EventDraft => ({ event_date: date, title: '', kind: 'religious', needs_live: true, start_time: '', location: '', note: '' });

export function EventDetails({ event, onEdit, onDelete }: { event: CalendarEvent; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <article className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-[#3f3300]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-yellow-300 px-2.5 py-0.5 text-xs font-semibold">{KIND_LABEL[event.kind]}</span>
            {event.needs_live && <span className="inline-flex items-center gap-1 rounded-full bg-[#0c3a2b] px-2.5 py-0.5 text-xs font-semibold text-[#c4f542]"><Radio size={12} />ต้องไลฟ์</span>}
          </div>
          <h4 className="mt-2 text-base font-semibold break-words">{event.title}</h4>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && <button className="work-icon h-9 w-9" title="แก้ไข" aria-label={`แก้ไข ${event.title}`} onClick={onEdit}><Pencil size={15} /></button>}
            {onDelete && <button className="work-icon h-9 w-9 text-red-600" title="ลบ" aria-label={`ลบ ${event.title}`} onClick={onDelete}><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-center gap-2"><Clock size={14} className="shrink-0" /><dd>{displayDate(event.event_date)}{event.start_time ? ` · ${event.start_time.slice(0, 5)} น.` : ''}</dd></div>
        {event.location && (
          <div className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" />
            <dd><a className="underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`} target="_blank" rel="noreferrer">{event.location}</a></dd>
          </div>
        )}
        {event.note && <dd className="whitespace-pre-wrap break-words pt-1 text-[#5c4a00]">{event.note}</dd>}
      </dl>
    </article>
  );
}

export function CalendarPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role === 'admin' || role === 'super_admin';
  const today = todayBangkok();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => groupByDate(events), [events]);

  const load = useCallback(async () => {
    try {
      setEvents(await listEvents(days[0], days[days.length - 1]));
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'โหลดปฏิทินไม่สำเร็จ'); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!draft) return;
    if (!draft.title.trim()) { setError('กรอกชื่อวันสำคัญ / งานไลฟ์'); return; }
    setBusy(true);
    try { await saveEvent(draft); setDraft(null); setSelected(draft.event_date); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function remove(event: CalendarEvent) {
    if (!window.confirm(`ลบ "${event.title}"?`)) return;
    try { await deleteEvent(event.id); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ'); }
  }

  const selectedEvents = byDate[selected] || [];
  const monthEvents = events.filter((e) => e.event_date.startsWith(month)).sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill-label">ปฏิทินทีม</span>
          <h2 className="mt-3 text-2xl font-bold">วันสำคัญทางศาสนา & ตารางไลฟ์</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">วันที่ไฮไลท์<span className="mx-1 rounded bg-yellow-300 px-1.5 font-semibold text-[#3f3300]">สีเหลือง</span>คือวันที่ทีมต้องไปไลฟ์ กดที่วันเพื่อดูสถานที่และหมายเหตุ</p>
        </div>
        {canEdit && (
          <button className="btn-pill btn-dark" onClick={() => { setError(''); setDraft(emptyDraft(selected)); }}>
            <Plus className="h-4 w-4" />เพิ่มวันสำคัญ<span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span>
          </button>
        )}
      </div>
      {error && !draft && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="hr-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button className="work-icon" aria-label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
            <div className="text-center">
              <h3 className="text-xl font-semibold">{monthTitle(month)}</h3>
              <p className="text-xs text-[var(--app-text-muted)]">{monthEvents.length} รายการเดือนนี้</p>
            </div>
            <button className="work-icon" aria-label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label={`ปฏิทิน ${monthTitle(month)}`}>
            {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-xs font-semibold text-[var(--app-text-muted)]">{d}</div>)}
            {days.map((date) => {
              const list = byDate[date] || [];
              const inMonth = date.startsWith(month);
              const marked = list.length > 0;
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${displayDate(date)}${marked ? ` · ${list.map((e) => e.title).join(', ')}` : ''}`}
                  onClick={() => setSelected(date)}
                  className={`relative flex min-h-[56px] flex-col items-stretch gap-1 rounded-xl border p-1.5 text-left transition sm:min-h-[92px] sm:p-2 ${
                    marked ? 'border-yellow-400 bg-yellow-200 text-[#3f3300] shadow-[0_0_14px_-4px_rgba(234,179,8,0.8)]' : 'border-[var(--app-border-muted)] bg-[var(--app-surface)]'
                  } ${inMonth ? '' : 'opacity-40'} ${isSelected ? 'ring-2 ring-[#0c3a2b] ring-offset-1' : ''}`}
                >
                  <span className={`text-sm font-semibold ${date === today ? 'grid h-6 w-6 place-items-center rounded-full bg-[#0c3a2b] text-[#c4f542]' : ''}`}>{Number(date.slice(8))}</span>
                  {list.slice(0, 2).map((e) => (
                    <span key={e.id} className="hidden truncate rounded-md bg-yellow-50/80 px-1.5 py-0.5 text-[11px] font-medium sm:block">
                      {e.needs_live && '● '}{e.title}
                    </span>
                  ))}
                  {list.length > 2 && <span className="hidden text-[11px] sm:block">+{list.length - 2} รายการ</span>}
                  {marked && <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-[#a16207] sm:hidden" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{displayDate(selected)}</h3>
            {canEdit && <button className="work-button" onClick={() => { setError(''); setDraft(emptyDraft(selected)); }}><Plus size={16} />เพิ่มวันนี้</button>}
          </div>
          {selectedEvents.length === 0 ? (
            <p className="hr-card p-6 text-sm text-[var(--app-text-muted)]">ไม่มีวันสำคัญหรือไลฟ์ในวันนี้</p>
          ) : selectedEvents.map((event) => (
            <EventDetails
              key={event.id}
              event={event}
              onEdit={canEdit ? () => { setError(''); setDraft({ ...event, start_time: event.start_time?.slice(0, 5) || '', location: event.location || '', note: event.note || '' }); } : undefined}
              onDelete={canEdit ? () => remove(event) : undefined}
            />
          ))}
          {monthEvents.length > 0 && (
            <div className="hr-card p-5">
              <h4 className="font-semibold">ทั้งหมดในเดือนนี้</h4>
              <ul className="mt-3 divide-y divide-[var(--app-border-muted)]">
                {monthEvents.map((e) => (
                  <li key={e.id}>
                    <button className="flex w-full items-center gap-3 py-2.5 text-left text-sm" onClick={() => setSelected(e.event_date)}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-yellow-200 font-semibold text-[#3f3300]">{Number(e.event_date.slice(8))}</span>
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      {e.needs_live && <Radio size={14} className="shrink-0 text-gold" aria-label="ต้องไลฟ์" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {draft && (
        <WorkDialog title={draft.id ? 'แก้ไขวันสำคัญ' : 'เพิ่มวันสำคัญ / งานไลฟ์'} busy={busy} onClose={() => setDraft(null)}>
          <div className="space-y-4">
            <label className="work-field">ชื่อ
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="เช่น วันมาฆบูชา, ไลฟ์ปลุกเสก" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="work-field">วันที่
                <input type="date" value={draft.event_date} onChange={(e) => e.target.value && setDraft({ ...draft, event_date: e.target.value })} />
              </label>
              <label className="work-field">เวลา (ไม่บังคับ)
                <input type="time" value={draft.start_time || ''} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} />
              </label>
            </div>
            <label className="work-field">ประเภท
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventKind })}>
                {Object.entries(KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="work-field">สถานที่
              <input value={draft.location || ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="เช่น วัดระฆังโฆสิตาราม" />
            </label>
            <label className="work-field">หมายเหตุ
              <textarea rows={3} value={draft.note || ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="อุปกรณ์ที่ต้องเตรียม, คนรับผิดชอบ, เวลานัด" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">ทีมต้องไปไลฟ์
              <input type="checkbox" className="h-5 w-5 accent-[#ca8a04]" checked={draft.needs_live} onChange={(e) => setDraft({ ...draft, needs_live: e.target.checked })} />
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="work-button" disabled={busy} onClick={() => setDraft(null)}><X size={16} />ยกเลิก</button>
              <button className="work-button work-primary" disabled={busy} onClick={submit}>บันทึก</button>
            </div>
          </div>
        </WorkDialog>
      )}
    </div>
  );
}
