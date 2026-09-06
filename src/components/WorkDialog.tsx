import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function WorkDialog({ title, busy, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="work-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" title="ปิด" aria-label="ปิด" disabled={busy} onClick={onClose} className="work-icon"><X size={20} /></button>
      </div>
      {children}
    </dialog>
  );
}
