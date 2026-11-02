import type { ReactNode } from 'react';
import { Hammer } from 'lucide-react';

export function ComingSoonPage({ title, phase, children }: { title: string; phase: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="glass-card w-full rounded-3xl border border-gold/20 p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Hammer className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6a5018]">{phase}</p>
            <h2 className="mt-2 text-2xl font-bold text-gold">{title}</h2>
            <div className="mt-3 text-sm leading-6 text-zinc-500">{children ?? 'หน้านี้กำลังพัฒนา'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
